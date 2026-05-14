import * as XLSX from "xlsx";

const path = process.argv[2];
const sheetArg = process.argv[3];
if (!path) {
  console.error("Uso: tsx scripts/inspect-xlsx.ts <caminho-do-xlsx> [aba]");
  process.exit(1);
}

const wb = XLSX.readFile(path);
const sheetNames = sheetArg ? [sheetArg] : wb.SheetNames;

for (const sheetName of sheetNames) {
  const ws = wb.Sheets[sheetName];
  if (!ws) continue;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });
  console.log(`\n=== "${sheetName}" — ${rows.length} linhas ===`);
  const maxRows = Math.min(rows.length, sheetArg ? 12 : 4);
  for (let i = 0; i < maxRows; i++) {
    console.log(`Linha ${i}:`, JSON.stringify(rows[i]));
  }
}
