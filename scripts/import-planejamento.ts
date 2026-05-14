import "dotenv/config";
import * as XLSX from "xlsx";
import { execute, query } from "../lib/db";

const PATH =
  process.env.PLANEJAMENTO_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";
const SHEET = "ALINHAMENTO E PREVENTIVA";

const COL = {
  EQUIP: 0,
  PLACA: 1,
  FROTA_GERAL: 2,
  LOCAL: 3,
  SETOR: 4,
  KM_ATUAL: 21,
} as const;

const FORCE = process.env.FORCE === "1";

function normalizePlaca(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  if (!t || t === "-") return null;
  return t;
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  if (!t || t === "-") return null;
  return t;
}

function asInt(v: unknown): number | null {
  if (v == null || v === "" || v === "-") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

// Escape para SQL literal (somente para inlinear strings curtas conhecidas, ex.: setor).
function sqlString(v: string | null): string {
  if (v == null) return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlInt(v: number | null): string {
  return v == null ? "NULL" : String(v);
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
  const wb = XLSX.readFile(PATH);
  const ws = wb.Sheets[SHEET];
  if (!ws) {
    console.error(`Aba "${SHEET}" nao encontrada. Abas: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });
  console.log(`${rows.length} linhas na planilha (incluindo cabecalho)`);

  console.log("Carregando snapshot das frotas...");
  const allFrotas = await query<{
    id: number;
    placa: string | null;
    frota_geral: string | null;
    km_atual: number | null;
    localizacao: string | null;
    km_origem: string | null;
  }>(
    `SELECT id, placa, frota_geral, km_atual, localizacao, km_origem
     FROM manutencao.cd.frotas
     WHERE ativo = TRUE`
  );

  const byPlaca = new Map<string, FrotaSnapshot>();
  const byFrotaGeral = new Map<string, FrotaSnapshot>();
  for (const f of allFrotas) {
    const placaNorm = normalizePlaca(f.placa);
    const snap: FrotaSnapshot = {
      id: f.id,
      placa_norm: placaNorm,
      frota_geral: f.frota_geral,
      km_atual: f.km_atual,
      localizacao: f.localizacao,
      km_origem: f.km_origem,
    };
    if (placaNorm) byPlaca.set(placaNorm, snap);
    if (f.frota_geral) byFrotaGeral.set(String(f.frota_geral).trim(), snap);
  }
  console.log(`Carregadas ${allFrotas.length} frotas`);

  // Coleta todas as mudancas em memoria
  const changes: RowChange[] = [];
  let semPlaca = 0;
  let semMatch = 0;
  let semKm = 0;
  let jaImportado = 0;
  const placasNaoEncontradas: string[] = [];

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i] ?? [];
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

  // Deduplica por frota_id (XLSX pode ter linhas duplicadas para a mesma frota).
  // Mantem a ultima ocorrencia para cada campo (KM/setor); mesclando se vier separado.
  const dedup = new Map<number, RowChange>();
  let duplicadas = 0;
  for (const c of changes) {
    const existing = dedup.get(c.id);
    if (!existing) {
      dedup.set(c.id, { ...c });
      continue;
    }
    duplicadas++;
    if (c.novoKm != null) {
      existing.novoKm = c.novoKm;
      existing.kmAnterior = c.kmAnterior;
    }
    if (c.novoSetor != null) existing.novoSetor = c.novoSetor;
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

  // Single MERGE com VALUES inline (executa todas as updates em uma transacao Databricks).
  const mergeValues = uniqueChanges
    .map((c) => `(${c.id}, ${sqlInt(c.novoKm)}, ${sqlString(c.novoSetor)})`)
    .join(",\n    ");

  const mergeSql = `MERGE INTO manutencao.cd.frotas t
USING (
  SELECT * FROM (VALUES
    ${mergeValues}
  ) AS src(id, km, setor)
) s ON t.id = s.id
WHEN MATCHED THEN UPDATE SET
  t.km_atual = COALESCE(s.km, t.km_atual),
  t.km_origem = CASE WHEN s.km IS NOT NULL THEN 'IMPORTACAO' ELSE t.km_origem END,
  t.km_atualizado_em = CASE WHEN s.km IS NOT NULL THEN current_timestamp() ELSE t.km_atualizado_em END,
  t.km_validado = CASE WHEN s.km IS NOT NULL THEN TRUE ELSE t.km_validado END,
  t.localizacao = COALESCE(s.setor, t.localizacao),
  t.atualizado_em = current_timestamp(),
  t.atualizado_por = 'import-planejamento'`;

  console.log(`\nExecutando MERGE em ${uniqueChanges.length} frotas...`);
  await execute(mergeSql);
  console.log("MERGE concluido.");

  // INSERT em massa no historico_km_frota apenas para as mudancas que tem KM novo
  const kmChanges = uniqueChanges.filter((c) => c.novoKm != null);
  if (kmChanges.length > 0) {
    const insertValues = kmChanges
      .map((c) => {
        const diff = c.kmAnterior != null && c.novoKm != null ? c.novoKm - c.kmAnterior : null;
        return `(${c.id}, NULL, NULL, NULL, ${sqlInt(c.kmAnterior)}, ${sqlInt(c.novoKm)}, ${sqlInt(diff)}, 'IMPORTACAO', NULL, TRUE, 'import-planejamento', current_timestamp(), 'KM importado da planilha PLANEJAMENTO DE MANUTENCAO', current_timestamp())`;
      })
      .join(",\n  ");

    const insertSql = `INSERT INTO manutencao.cd.historico_km_frota
  (frota_id, checklist_id, motorista_id, motorista_nome, km_anterior, km_novo,
   diferenca_km, origem, foto_km_url, validado, validado_por, validado_em,
   observacao_validacao, criado_em)
VALUES
  ${insertValues}`;

    console.log(`Inserindo ${kmChanges.length} entradas em historico_km_frota...`);
    await execute(insertSql);
    console.log("INSERT historico_km_frota concluido.");
  }

  const kmUpdates = uniqueChanges.filter((c) => c.novoKm != null).length;
  const setorUpdates = uniqueChanges.filter((c) => c.novoSetor != null).length;

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
    for (const p of placasNaoEncontradas.slice(0, 30)) console.log(`  - ${p}`);
    if (placasNaoEncontradas.length > 30) console.log(`  ...e mais ${placasNaoEncontradas.length - 30}`);
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
