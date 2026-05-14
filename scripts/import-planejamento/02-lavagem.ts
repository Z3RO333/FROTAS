import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { excelDateToIso, normEquip, normPlaca, normFrota, normStatus, nullify, asInt } from "./utils";

const XLSX_PATH =
  process.env.XLSX_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

export async function runLavagem(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const ws = wb.Sheets["Lavagem_2"];
  if (!ws) throw new Error("Aba Lavagem_2 não encontrada");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const payload = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const equip = normEquip(r[0]);
    const placa = normPlaca(r[1]);
    if (!equip && !placa) continue;
    payload.push({
      equipamento: equip,
      placa,
      frota_numero: normFrota(r[2]),
      setor: nullify(r[3]),
      data_realizada: excelDateToIso(r[4]),
      intervalo_dias: asInt(r[5]),
      proxima_data: excelDateToIso(r[6]),
      dias_apos: asInt(r[7]),
      atraso_dias: asInt(r[8]),
      status: normStatus(r[9]),
      powerapps_id: nullify(r[10]),
      batch_id: batchId,
    });
  }

  const { error } = await supabaseManutencao
    .from("fact_lavagem")
    .upsert(payload, { onConflict: "equipamento,data_realizada", ignoreDuplicates: false });
  if (error) throw error;
  console.log(`[02-lavagem] ${payload.length} registros upserted`);
}

if (require.main === module) {
  const batchId = randomUUID();
  runLavagem(batchId)
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
