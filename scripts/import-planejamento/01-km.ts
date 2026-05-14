import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { asInt, normFrota } from "./utils";

const XLSX_PATH =
  process.env.XLSX_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";
const BATCH_SIZE = 500;

export async function runKm(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const ws = wb.Sheets["IMPORTKM"];
  if (!ws) throw new Error("Aba IMPORTKM não encontrada");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const payload: Array<{ frota_numero: string | null; km: number; equipamento: null; batch_id: string }> = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const frota = normFrota(r[0]);
    const km = asInt(r[1]);
    if (frota == null || km == null || km <= 0) continue;
    payload.push({ frota_numero: frota, km, equipamento: null, batch_id: batchId });
  }

  let inserted = 0;
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const chunk = payload.slice(i, i + BATCH_SIZE);
    const { error } = await supabaseManutencao.from("fact_km_frota").insert(chunk);
    if (error) console.warn("[01-km] erro:", error.message);
    else inserted += chunk.length;
  }
  console.log(`[01-km] ${inserted} registros de KM inseridos`);
}

if (require.main === module) {
  const batchId = randomUUID();
  runKm(batchId)
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
