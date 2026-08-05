import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

// Mescla registros duplicados em `documents` (mesma frota+placa em mais de uma
// linha) num único registro por frota, mantendo o arquivo mais recente de cada
// tipo (DUT/CRLV) e removendo as linhas e PDFs sobrando do Storage.
// Rode sem --apply primeiro para ver o que seria feito (dry-run).

const URL = process.env.SUPABASE_MANUTENCAO_URL!;
const KEY = process.env.SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY!;
const BUCKET = "documents";
const APPLY = process.argv.includes("--apply");

const supabase = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

type Row = {
  id: string;
  frota: string;
  placa: string;
  dut_url: string | null;
  crlv_url: string | null;
  created_at: string;
  updated_at: string;
};

async function fetchAll(): Promise<Row[]> {
  const rows: Row[] = [];
  const chunkSize = 1000;
  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await supabase
      .from("documents")
      .select("id,frota,placa,dut_url,crlv_url,created_at,updated_at")
      .range(from, from + chunkSize - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as Row[];
    rows.push(...chunk);
    if (chunk.length < chunkSize) break;
  }
  return rows;
}

function newest(rows: Row[]): Row {
  return rows.reduce((best, r) => (r.updated_at > best.updated_at ? r : best));
}

// Mesma normalização usada em app/(app)/documentos/_actions.ts (normalizePlate)
// ao criar um documento — precisamos agrupar por esse valor, não pela placa
// crua, porque "TAF-3F98" e "TAF3F98" são a mesma placa formatada diferente.
function normalizePlate(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function main() {
  if (!URL || !KEY) {
    console.error("SUPABASE_MANUTENCAO_URL / SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY não definidas no .env");
    process.exit(1);
  }

  console.log(`Modo: ${APPLY ? "APLICANDO mudanças" : "DRY-RUN (nada será alterado — use --apply para executar)"}\n`);

  const all = await fetchAll();
  const groups = new Map<string, Row[]>();
  for (const row of all) {
    const key = `${row.frota}::${normalizePlate(row.placa)}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const dupGroups = [...groups.entries()].filter(([, rows]) => rows.length > 1);
  console.log(`Grupos duplicados: ${dupGroups.length} (${dupGroups.reduce((n, [, r]) => n + r.length, 0)} linhas envolvidas)\n`);

  let merged = 0;
  let deletedRows = 0;
  let deletedFiles = 0;

  for (const [key, rows] of dupGroups) {
    const target = newest(rows);
    const dutCandidates = rows.filter((r) => r.dut_url);
    const crlvCandidates = rows.filter((r) => r.crlv_url);
    const bestDut = dutCandidates.length > 0 ? newest(dutCandidates).dut_url : null;
    const bestCrlv = crlvCandidates.length > 0 ? newest(crlvCandidates).crlv_url : null;

    const losers = rows.filter((r) => r.id !== target.id);
    const filesToRemove = rows
      .flatMap((r) => [r.dut_url, r.crlv_url])
      .filter((path): path is string => Boolean(path) && path !== bestDut && path !== bestCrlv);

    console.log(
      `[${key}] mantém ${target.id} (dut=${bestDut ? "sim" : "não"}, crlv=${bestCrlv ? "sim" : "não"}) ` +
        `— remove ${losers.length} linha(s), ${filesToRemove.length} arquivo(s) órfão(s)`
    );

    if (APPLY) {
      const { error: updError } = await supabase
        .from("documents")
        .update({
          placa: normalizePlate(target.placa),
          dut_url: bestDut,
          crlv_url: bestCrlv,
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.id);
      if (updError) {
        console.error(`  Erro ao atualizar ${target.id}: ${updError.message}`);
        continue;
      }

      const { error: delError } = await supabase
        .from("documents")
        .delete()
        .in("id", losers.map((r) => r.id));
      if (delError) {
        console.error(`  Erro ao apagar duplicatas de ${key}: ${delError.message}`);
        continue;
      }
      deletedRows += losers.length;

      if (filesToRemove.length > 0) {
        const { error: storageError } = await supabase.storage.from(BUCKET).remove(filesToRemove);
        if (storageError) {
          console.error(`  Erro ao remover arquivos órfãos de ${key}: ${storageError.message}`);
        } else {
          deletedFiles += filesToRemove.length;
        }
      }
    }

    merged++;
  }

  console.log(`\n${APPLY ? "Concluído" : "Simulação concluída"}: ${merged} grupo(s) mesclado(s), ${APPLY ? deletedRows : dupGroups.reduce((n, [, r]) => n + r.length - 1, 0)} linha(s) removida(s)${APPLY ? `, ${deletedFiles} arquivo(s) removido(s) do storage` : ""}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
