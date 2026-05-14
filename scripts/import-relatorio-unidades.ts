import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { supabaseManutencao } from "../lib/supabase-manutencao";

const XLSX_PATH =
  process.argv[2] ||
  process.env.RELATORIO_UNIDADES_PATH ||
  "C:\\Users\\21664\\Downloads\\relatorio.xlsx";

type Row = Record<string, unknown>;

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

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

(async () => {
  const fileName = path.basename(XLSX_PATH);
  console.log(`Lendo ${XLSX_PATH}...`);

  const workbook = XLSX.read(fs.readFileSync(XLSX_PATH), { cellDates: false });
  const rowsBySheet = workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, raw: false });
    return rows.map((row) => ({ row, sheetName }));
  });

  const { error: deleteError } = await supabaseManutencao
    .from("unidades_operacionais")
    .delete()
    .like("origem_arquivo", `${fileName}#%`);
  if (deleteError) throw deleteError;

  let inserted = 0;
  let skipped = 0;
  const records = [];

  for (const { row, sheetName } of rowsBySheet) {
    const loja = get(row, "Lojas");
    const centro = get(row, "Centro");
    const cnpj = get(row, "CNPJ");

    if (!loja && !centro && !cnpj) {
      skipped++;
      continue;
    }

    records.push({
      uf: get(row, "UF"),
      negocio: get(row, "Negocio"),
      loja,
      centro,
      centro_custo: get(row, "Centro de Custo"),
      local_negocio: get(row, "Local Neg"),
      cnpj,
      inscricao_estadual: get(row, "Insc estadual"),
      inscricao_suframa: get(row, "Insc Suframa"),
      inscricao_municipal: get(row, "Insc Municipal"),
      cep: get(row, "CEP"),
      endereco: get(row, "Endereco"),
      ie_subst_tributario: get(row, "IE-Subst. Tributario"),
      origem_arquivo: `${fileName}#${sheetName}`,
    });
    inserted++;
  }

  for (const part of chunk(records, 500)) {
    const { error } = await supabaseManutencao
      .from("unidades_operacionais")
      .insert(part);
    if (error) throw error;
  }

  console.log(
    `Importacao concluida: ${inserted} unidades inseridas, ${skipped} linhas ignoradas, ${workbook.SheetNames.length} aba(s).`
  );
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
