import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { excelDateToIso, normPlaca, normFrota, nullify, asInt } from "./utils";

const XLSX_PATH = process.env.XLSX_PATH || "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

export async function runEstepes(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const ws = wb.Sheets["Controle de Estepes"];
  if (!ws) throw new Error("Aba Controle de Estepes não encontrada");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const map = new Map<string, Record<string, unknown>>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const placa = normPlaca(r[1]);
    if (!placa) continue;
    const estepeVal = String(r[7] ?? "").trim().toUpperCase();
    map.set(placa, {
      frota_numero: normFrota(r[0]),
      placa,
      modelo: nullify(r[2]),
      ano: asInt(r[3]),
      local: nullify(r[5]),
      setor: nullify(r[6]),
      tem_estepe: estepeVal === "SIM",
      data_verificacao: excelDateToIso(r[8]),
      batch_id: batchId,
    });
  }
  const payload = Array.from(map.values());

  const { error } = await supabaseManutencao
    .from("fact_estepes")
    .upsert(payload, { onConflict: "placa" });
  if (error) throw error;
  console.log(`[05-estepes] ${payload.length} registros upserted`);
}

if (require.main === module) {
  const batchId = randomUUID();
  runEstepes(batchId).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
