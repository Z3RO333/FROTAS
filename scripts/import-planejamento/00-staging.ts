import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { hashLinha } from "./utils";

const XLSX_PATH =
  process.env.XLSX_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

const BATCH_SIZE = 200;

export async function runStaging(batchId: string): Promise<void> {
  console.log(`[00-staging] Lendo ${XLSX_PATH}...`);
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const nomeArquivo = XLSX_PATH.split(/[\\/]/).pop() ?? XLSX_PATH;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });
    if (rows.length < 2) continue;

    const payload: Array<{
      batch_id: string; nome_arquivo: string; aba_origem: string;
      linha_origem: number; dados_json: unknown; hash_linha: string;
    }> = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] as unknown[];
      const allNull = r.every((c) => c == null || c === "");
      if (allNull) continue;
      const dados = Object.fromEntries(r.map((v, j) => [j, v]));
      payload.push({
        batch_id: batchId,
        nome_arquivo: nomeArquivo,
        aba_origem: sheetName,
        linha_origem: i + 1,
        dados_json: dados,
        hash_linha: hashLinha(dados),
      });
    }

    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const chunk = payload.slice(i, i + BATCH_SIZE);
      const { error } = await supabaseManutencao
        .from("staging_excel_importacao")
        .upsert(chunk, { onConflict: "batch_id,aba_origem,hash_linha", ignoreDuplicates: true });
      if (error) console.warn(`[staging] aba=${sheetName} erro:`, error.message);
    }
    console.log(`  [staging] ${sheetName}: ${payload.length} linhas`);
  }
}

if (require.main === module) {
  const batchId = randomUUID();
  console.log(`batch_id: ${batchId}`);
  runStaging(batchId)
    .then(() => { console.log("Staging concluído"); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
