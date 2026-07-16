import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { excelDateToIso, nullify, asInt, normFrota } from "./utils";

const XLSX_PATH = process.env.XLSX_PATH || "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

const POSITION_PATTERN = /^(DD|DE|TDE|TDI|TEE|TEI|STEP|ESTEPE|TRASEIRO|DIANTEIRO)/i;

export async function runPneus(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const sheetName = Object.keys(wb.Sheets).find(n => n.trim() === "MARCAÇÃO DE PNEUS");
  if (!sheetName) throw new Error("Aba MARCAÇÃO DE PNEUS não encontrada");
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  let currentEquip: string | null = null;
  let currentFrota: string | null = null;
  let currentKm: number | null = null;

  const seen = new Map<string, Record<string, unknown>>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const col0 = r[0];
    const col0Str = col0 != null ? String(col0).trim().toUpperCase() : "";

    // Skip title/header rows
    if (col0Str === "EQUIPAMENTO" || col0Str === "NÚMEROS DE FOGOS DAS FROTAS") continue;
    if (col0 == null && r[3] == null) continue;

    // Detect row type
    const col0Num = typeof col0 === "number" ? col0 : null;

    if (col0Num != null && col0Num >= 700000) {
      // Equipment ID row
      currentEquip = String(col0Num);
      currentFrota = normFrota(r[1]);
      currentKm = asInt(r[2]);
    } else if (col0Str.length > 0 && isNaN(Number(col0))) {
      // City/section header row — also carries first pneu data
      // Don't update currentEquip here (it will be updated by the 750xxx row that follows)
      if (asInt(r[2]) != null) currentKm = asInt(r[2]);
      if (r[1] != null && !isNaN(Number(r[1]))) currentFrota = normFrota(r[1]);
    } else if (col0Num != null && col0Num < 700000 && col0Num > 0) {
      // Small number in col0 = frota number
      currentFrota = String(col0Num);
      if (asInt(r[2]) != null) currentKm = asInt(r[2]);
    }

    // Extract pneu data from this row
    const posicao = nullify(r[3]);
    const numeroFogo = nullify(r[4]);
    const km = asInt(r[2]) ?? currentKm;

    if (!posicao) continue;
    // Must have at least a recognizable position OR a valid fire number
    if (!POSITION_PATTERN.test(posicao) && !numeroFogo) continue;

    const equip = currentEquip;
    const key = `${equip ?? currentFrota}_${posicao}`;

    seen.set(key, {
      equipamento: equip,
      frota_numero: currentFrota,
      km_frota: km,
      posicao,
      numero_fogo: numeroFogo,
      marca: nullify(r[5]),
      dt_montagem: excelDateToIso(r[6]),
      dt_atualizado: excelDateToIso(r[7]),
      numero_fogo_anterior: nullify(r[8]),
      marca_anterior: nullify(r[9]),
      status: nullify(r[10]),
      marcado: String(r[11] ?? "").trim().toUpperCase() === "SIM",
      observacoes: nullify(r[12]),
      batch_id: batchId,
    });
  }

  const payload = [...seen.values()];
  let upserted = 0;
  const CHUNK = 200;

  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { error } = await supabaseManutencao
      .from("fact_pneus")
      .upsert(chunk, { onConflict: "equipamento,posicao" });
    if (error) console.warn("[08-pneus] erro:", error.message);
    else upserted += chunk.length;
  }

  console.log(`[08-pneus] ${payload.length} pneus únicos (equip×posição), ${upserted} upserted`);
}

if (require.main === module) {
  const batchId = randomUUID();
  runPneus(batchId).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
