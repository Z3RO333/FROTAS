import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { supabaseManutencao } from "../lib/supabase-manutencao";

const PATH =
  process.env.PLANEJAMENTO_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENCAO- ATUAL.xlsx";
const SHEET = "ALINHAMENTO E PREVENTIVA";

const COL = {
  PLACA: 1,
  FROTA_GERAL: 2,
  SETOR: 4,
  KM_ATUAL: 21,
} as const;

const FORCE = process.env.FORCE === "1";

function normalizePlaca(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  if (!text || text === "-") return null;
  return text;
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text === "-") return null;
  return text;
}

function asInt(value: unknown): number | null {
  if (value == null || value === "" || value === "-") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

type FrotaSnapshot = {
  id: number;
  placa_norm: string | null;
  frota_geral: string | null;
  km_atual: number | null;
  localizacao: string | null;
  km_origem: string | null;
};

type RowChange = {
  id: number;
  novoKm: number | null;
  novoSetor: string | null;
  kmAnterior: number | null;
};

(async () => {
  console.log(`Lendo ${PATH} (aba "${SHEET}")...`);
  const workbook = XLSX.read(fs.readFileSync(PATH));
  const sheet = workbook.Sheets[SHEET];
  if (!sheet) {
    console.error(`Aba "${SHEET}" nao encontrada. Abas: ${workbook.SheetNames.join(", ")}`);
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: null, header: 1 });
  console.log(`${rows.length} linhas na planilha (incluindo cabecalho)`);

  console.log("Carregando snapshot das frotas...");
  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select("id,placa,codigo_frota,km_atual,local,km_origem")
    .eq("ativo", true)
    .limit(50000);
  if (error) throw error;

  const byPlaca = new Map<string, FrotaSnapshot>();
  const byFrotaGeral = new Map<string, FrotaSnapshot>();
  for (const frota of data ?? []) {
    const placaNorm = normalizePlaca(frota.placa);
    const snap: FrotaSnapshot = {
      id: Number(frota.id),
      placa_norm: placaNorm,
      frota_geral: frota.codigo_frota,
      km_atual: frota.km_atual,
      localizacao: frota.local,
      km_origem: frota.km_origem,
    };
    if (placaNorm) byPlaca.set(placaNorm, snap);
    if (frota.codigo_frota) byFrotaGeral.set(String(frota.codigo_frota).trim(), snap);
  }
  console.log(`Carregadas ${data?.length ?? 0} frotas`);

  const changes: RowChange[] = [];
  let semPlaca = 0;
  let semMatch = 0;
  let semKm = 0;
  let jaImportado = 0;
  const placasNaoEncontradas: string[] = [];

  for (let index = 2; index < rows.length; index++) {
    const row = rows[index] ?? [];
    const placaNorm = normalizePlaca(row[COL.PLACA]);
    if (!placaNorm) {
      semPlaca++;
      continue;
    }

    const frotaGeral = asString(row[COL.FROTA_GERAL]);
    const setor = asString(row[COL.SETOR]);
    const km = asInt(row[COL.KM_ATUAL]);

    const snap = byPlaca.get(placaNorm) ?? (frotaGeral ? byFrotaGeral.get(frotaGeral) : undefined);
    if (!snap) {
      semMatch++;
      placasNaoEncontradas.push(`${row[COL.PLACA]} (frota ${frotaGeral ?? "?"})`);
      continue;
    }

    if (!FORCE && snap.km_origem === "IMPORTACAO" && km != null && snap.km_atual === km) {
      jaImportado++;
      continue;
    }

    const novoKm = km != null && km > 0 ? km : null;
    const novoSetor = setor && setor !== snap.localizacao ? setor : null;

    if (novoKm == null) semKm++;
    if (novoKm == null && novoSetor == null) continue;

    changes.push({
      id: snap.id,
      novoKm,
      novoSetor,
      kmAnterior: snap.km_atual,
    });
  }

  const dedup = new Map<number, RowChange>();
  let duplicadas = 0;
  for (const change of changes) {
    const existing = dedup.get(change.id);
    if (!existing) {
      dedup.set(change.id, { ...change });
      continue;
    }
    duplicadas++;
    if (change.novoKm != null) {
      existing.novoKm = change.novoKm;
      existing.kmAnterior = change.kmAnterior;
    }
    if (change.novoSetor != null) existing.novoSetor = change.novoSetor;
  }
  const uniqueChanges = Array.from(dedup.values());

  console.log(`Mudancas detectadas: ${changes.length} (${duplicadas} duplicadas mescladas -> ${uniqueChanges.length} unicas)`);
  console.log(`  Sem placa:           ${semPlaca}`);
  console.log(`  Sem match no banco:  ${semMatch}`);
  console.log(`  Sem KM na linha:     ${semKm}`);
  console.log(`  Ja importadas:       ${jaImportado}`);

  if (uniqueChanges.length === 0) {
    console.log("Nada a fazer. Saindo.");
    process.exit(0);
  }

  for (const change of uniqueChanges) {
    const update = {
      km_atual: change.novoKm ?? undefined,
      km_origem: change.novoKm != null ? "IMPORTACAO" : undefined,
      km_atualizado_em: change.novoKm != null ? new Date().toISOString() : undefined,
      km_validado: change.novoKm != null ? true : undefined,
      local: change.novoSetor ?? undefined,
      atualizado_por: "import-planejamento",
    };

    const { error: updateError } = await supabaseManutencao
      .from("veiculos")
      .update(update)
      .eq("id", change.id);
    if (updateError) throw updateError;
  }

  const kmChanges = uniqueChanges.filter((change) => change.novoKm != null);
  if (kmChanges.length > 0) {
    const payload = kmChanges.map((change) => ({
      frota_id: change.id,
      checklist_id: null,
      motorista_id: null,
      motorista_nome: null,
      km_anterior: change.kmAnterior,
      km_novo: change.novoKm,
      diferenca_km: change.kmAnterior != null && change.novoKm != null ? change.novoKm - change.kmAnterior : null,
      origem: "IMPORTACAO",
      foto_km_url: null,
      validado: true,
      validado_por: "import-planejamento",
      validado_em: new Date().toISOString(),
      observacao_validacao: "KM importado da planilha PLANEJAMENTO DE MANUTENCAO",
    }));

    const { error: historyError } = await supabaseManutencao
      .from("historico_km_frota")
      .insert(payload);
    if (historyError) throw historyError;
  }

  const kmUpdates = uniqueChanges.filter((change) => change.novoKm != null).length;
  const setorUpdates = uniqueChanges.filter((change) => change.novoSetor != null).length;

  console.log("\nResumo final:");
  console.log(`  Frotas afetadas:      ${uniqueChanges.length}`);
  console.log(`  KMs atualizados:      ${kmUpdates}`);
  console.log(`  Setores atualizados:  ${setorUpdates}`);
  console.log(`  Linhas sem placa:     ${semPlaca}`);
  console.log(`  Frotas sem match:     ${semMatch}`);
  console.log(`  Linhas sem KM:        ${semKm}`);
  console.log(`  Ja importadas antes:  ${jaImportado}`);

  if (placasNaoEncontradas.length > 0) {
    console.log("\nPlacas/frotas nao encontradas no banco:");
    for (const placa of placasNaoEncontradas.slice(0, 30)) console.log(`  - ${placa}`);
    if (placasNaoEncontradas.length > 30) console.log(`  ...e mais ${placasNaoEncontradas.length - 30}`);
  }

  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
