import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { excelDateToIso, asInt, asNum, nullify } from "./utils";

const XLSX_PATH = process.env.XLSX_PATH || "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

async function runDisponibilidadeDiaria(wb: XLSX.WorkBook, batchId: string): Promise<void> {
  const ws = wb.Sheets["DISPOBILIDADE TOTAL"];
  if (!ws) return;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const map = new Map<string, Record<string, unknown>>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const data = excelDateToIso(r[0]);
    if (!data) continue;
    const total = asInt(r[1]);
    if (total == null) continue;
    map.set(data, {
      data,
      total,
      parados: asInt(r[2]),
      disponibilidade: asNum(r[3]),
      meta: asNum(r[4]),
      batch_id: batchId,
    });
  }
  const payload = Array.from(map.values());

  const { error } = await supabaseManutencao
    .from("fact_disponibilidade_diaria")
    .upsert(payload, { onConflict: "data" });
  if (error) throw error;
  console.log(`[06-disp-diaria] ${payload.length} registros`);
}

async function runDisponibilidadeTipo(wb: XLSX.WorkBook, batchId: string): Promise<void> {
  const ws = wb.Sheets["Disponib. Tipo Frota"];
  if (!ws) return;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const map = new Map<string, Record<string, unknown>>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const data = excelDateToIso(r[0]);
    const tipo = nullify(r[1]);
    if (!data || !tipo) continue;
    const total = asInt(r[2]);
    if (total == null) continue;
    const key = `${data}||${tipo.trim().toUpperCase()}`;
    map.set(key, {
      data,
      tipo_equipamento: tipo.trim().toUpperCase(),
      total,
      parados: asInt(r[3]),
      disponibilidade: asNum(r[4]),
      batch_id: batchId,
    });
  }
  const payload = Array.from(map.values());

  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500);
    const { error } = await supabaseManutencao
      .from("fact_disponibilidade_tipo_frota")
      .upsert(chunk, { onConflict: "data,tipo_equipamento" });
    if (error) throw error;
  }
  console.log(`[06-disp-tipo] ${payload.length} registros`);
}

export async function runDisponibilidade(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  await runDisponibilidadeDiaria(wb, batchId);
  await runDisponibilidadeTipo(wb, batchId);
}

if (require.main === module) {
  const batchId = randomUUID();
  runDisponibilidade(batchId).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
