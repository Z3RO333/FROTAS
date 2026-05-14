import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { excelDateToIso, normEquip, normPlaca, normFrota, normStatus, nullify, asInt } from "./utils";

const XLSX_PATH = process.env.XLSX_PATH || "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

export async function runTacografo(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const sheetName = Object.keys(wb.Sheets).find(n => n.trim().startsWith("FROTAS BEMOLGRU TACÓGRAFO."));
  if (!sheetName) throw new Error("Aba FROTAS BEMOLGRU TACÓGRAFO.... não encontrada");
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const seen = new Map<string, Record<string, unknown>>();

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const equip = normEquip(r[1]);
    const placa = normPlaca(r[4]);
    if (!equip && !placa) continue;

    const base = {
      equipamento: equip,
      placa,
      frota_numero: normFrota(r[3]),
      localizacao: nullify(r[26]),
      batch_id: batchId,
    };

    // TACOGRAFO
    const tacoStatus = normStatus(r[15]);
    if (tacoStatus || excelDateToIso(r[10])) {
      const key = `${equip ?? placa}_TACOGRAFO`;
      seen.set(key, {
        ...base,
        tipo_documento: "TACOGRAFO",
        data_realizada: excelDateToIso(r[10]),
        media_dias: asInt(r[11]),
        dias_passados: asInt(r[12]),
        desvio: asInt(r[13]),
        data_vencimento: excelDateToIso(r[14]),
        status: tacoStatus,
        link_documento: nullify(r[16]),
      });
    }

    // CRLV
    const crlvStatus = normStatus(r[25]);
    if (crlvStatus || excelDateToIso(r[18])) {
      const key = `${equip ?? placa}_CRLV`;
      seen.set(key, {
        ...base,
        tipo_documento: "CRLV",
        data_realizada: excelDateToIso(r[18]),
        media_dias: asInt(r[19]),
        dias_passados: asInt(r[20]),
        desvio: asInt(r[21]),
        data_vencimento: excelDateToIso(r[22]),
        status: crlvStatus,
        link_documento: nullify(r[23]),
      });
    }

    // DUT
    const dutVenc = nullify(r[24]);
    if (dutVenc && dutVenc !== "-") {
      const key = `${equip ?? placa}_DUT`;
      seen.set(key, {
        ...base,
        tipo_documento: "DUT",
        data_realizada: null,
        media_dias: null,
        dias_passados: null,
        desvio: null,
        data_vencimento: excelDateToIso(r[24]),
        status: normStatus(r[25]),
        link_documento: null,
      });
    }
  }

  const payload = [...seen.values()];
  let upserted = 0;
  for (let i = 0; i < payload.length; i += 200) {
    const chunk = payload.slice(i, i + 200);
    const { error } = await supabaseManutencao
      .from("fact_documentos_frota")
      .upsert(chunk, { onConflict: "equipamento,tipo_documento" });
    if (error) console.warn("[09-tacografo] erro:", error.message);
    else upserted += chunk.length;
  }

  console.log(`[09-tacografo] ${payload.length} registros de documentos, ${upserted} upserted`);
}

if (require.main === module) {
  const batchId = randomUUID();
  runTacografo(batchId).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
