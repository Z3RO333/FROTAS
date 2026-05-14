import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { excelDateToIso, normEquip, normPlaca, normFrota, nullify, asInt } from "./utils";

const XLSX_PATH = process.env.XLSX_PATH || "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

export async function runBateria(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const ws = wb.Sheets["Bateria - Garantia"];
  if (!ws) throw new Error("Aba Bateria - Garantia não encontrada");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const map = new Map<string, Record<string, unknown>>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const equip = normEquip(r[0]);
    if (!equip) continue;
    map.set(equip, {
      equipamento: equip,
      placa: normPlaca(r[1]),
      frota_numero: normFrota(r[2]),
      setor: nullify(r[3]),
      data_compra: excelDateToIso(r[4]),
      modelo_bateria: nullify(r[5]),
      loja: nullify(r[6]),
      orcamento: asInt(r[7]),
      batch_id: batchId,
    });
  }
  const payload = Array.from(map.values());

  const { error } = await supabaseManutencao
    .from("fact_bateria_garantia")
    .upsert(payload, { onConflict: "equipamento" });
  if (error) throw error;
  console.log(`[03-bateria] ${payload.length} registros upserted`);
}

if (require.main === module) {
  const batchId = randomUUID();
  runBateria(batchId).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
