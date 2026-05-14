import "dotenv/config";
import path from "node:path";
import * as XLSX from "xlsx";
import { execute, SCHEMA_FQN } from "../lib/db";

const XLSX_PATH =
  process.argv[2] ||
  process.env.RELATORIO_UNIDADES_PATH ||
  "C:\\Users\\21664\\Downloads\\relatorio.xlsx";

type Row = Record<string, unknown>;

const INSERT_COLUMNS = `(
  uf,
  negocio,
  loja,
  centro,
  centro_custo,
  local_negocio,
  cnpj,
  inscricao_estadual,
  inscricao_suframa,
  inscricao_municipal,
  cep,
  endereco,
  ie_subst_tributario,
  origem_arquivo,
  importado_em
)`;

function clean(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();
}

function get(row: Row, column: string): string | null {
  const wanted = normalizeKey(column);
  const key = Object.keys(row).find((name) => normalizeKey(name) === wanted);
  return key ? clean(row[key]) : null;
}

function sqlString(value: string | null): string {
  if (value == null) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

(async () => {
  const fileName = path.basename(XLSX_PATH);
  console.log(`Lendo ${XLSX_PATH}...`);

  const workbook = XLSX.readFile(XLSX_PATH, { cellDates: false });
  const rowsBySheet = workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, raw: false });
    return rows.map((row) => ({ row, sheetName }));
  });

  await execute(`DELETE FROM ${SCHEMA_FQN}.unidades_operacionais WHERE origem_arquivo LIKE ?`, [
    `${fileName}#%`,
  ]);

  let inserted = 0;
  let skipped = 0;
  const values: string[] = [];

  for (const { row, sheetName } of rowsBySheet) {
    const loja = get(row, "Lojas");
    const centro = get(row, "Centro");
    const cnpj = get(row, "CNPJ");

    if (!loja && !centro && !cnpj) {
      skipped++;
      continue;
    }

    const record = [
      get(row, "UF"),
      get(row, "Negócio"),
      loja,
      centro,
      get(row, "Centro de Custo"),
      get(row, "Local Neg"),
      cnpj,
      get(row, "Insc estadual"),
      get(row, "Insc Suframa"),
      get(row, "Insc Municipal"),
      get(row, "CEP"),
      get(row, "Endereço"),
      get(row, "IE-Subst. Tributário"),
      `${fileName}#${sheetName}`,
    ];
    values.push(`(${record.map(sqlString).join(", ")}, current_timestamp())`);
    inserted++;
  }

  for (const part of chunk(values, 100)) {
    await execute(
      `INSERT INTO ${SCHEMA_FQN}.unidades_operacionais ${INSERT_COLUMNS} VALUES ${part.join(", ")}`
    );
  }

  console.log(
    `Importação concluída: ${inserted} unidades inseridas, ${skipped} linhas ignoradas, ${workbook.SheetNames.length} aba(s).`
  );
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
