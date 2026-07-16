import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { excelDateToIso, normEquip, normPlaca, normFrota, normStatus, nullify, asInt } from "./utils";

const XLSX_PATH = process.env.XLSX_PATH || "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

type ServicoConfig = {
  tipo: string;
  data: number;
  media: number;
  km_inicial: number | null;
  km_rodados: number | null;
  dias: number | null;
  desvio: number | null;
  status: number;
};

const SERVICOS: ServicoConfig[] = [
  { tipo: "AR_CONDICIONADO",  data: 5,  media: 6,  km_inicial: null, km_rodados: null, dias: 7,    desvio: 8,    status: 9  },
  { tipo: "ALINHAMENTO",      data: 10, media: 12, km_inicial: 11,   km_rodados: 13,   dias: null, desvio: null, status: 14 },
  { tipo: "PREVENTIVA_MOTOR", data: 15, media: 17, km_inicial: 16,   km_rodados: 18,   dias: null, desvio: 19,   status: 20 },
  { tipo: "EMBREAGEM",        data: 22, media: 23, km_inicial: null, km_rodados: null, dias: 24,   desvio: 25,   status: 26 },
  { tipo: "TACOGRAFO",        data: 27, media: 28, km_inicial: null, km_rodados: null, dias: 29,   desvio: 30,   status: 31 },
  { tipo: "PORTA_ROOL_UP",    data: 32, media: 33, km_inicial: null, km_rodados: null, dias: 34,   desvio: 35,   status: 36 },
  { tipo: "SUSPENSAO",        data: 37, media: 38, km_inicial: 39,   km_rodados: 40,   dias: null, desvio: 41,   status: 42 },
];

export async function runAlinhamento(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const ws = wb.Sheets["ALINHAMENTO E PREVENTIVA"];
  if (!ws) throw new Error("Aba ALINHAMENTO E PREVENTIVA não encontrada");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  // Deduplica por (equipamento, tipo_servico) — mantém último
  const seen = new Map<string, Record<string, unknown>>();

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const equip = normEquip(r[0]);
    const placa = normPlaca(r[1]);
    if (!equip && !placa) continue;

    for (const s of SERVICOS) {
      const statusVal = normStatus(r[s.status]);
      const dataVal = excelDateToIso(r[s.data]);
      // Skip row if all service columns are null/dash
      if (!dataVal && !statusVal && asInt(r[s.media]) == null) continue;

      const key = `${equip ?? placa}_${s.tipo}`;
      seen.set(key, {
        equipamento: equip,
        placa,
        frota_numero: normFrota(r[2]),
        local: nullify(r[3]),
        setor: nullify(r[4]),
        tipo_servico: s.tipo,
        data_realizada: dataVal,
        km_inicial: s.km_inicial != null ? asInt(r[s.km_inicial]) : null,
        km_rodados: s.km_rodados != null ? asInt(r[s.km_rodados]) : null,
        media_intervalo: asInt(r[s.media]),
        desvio: s.desvio != null ? asInt(r[s.desvio]) : null,
        status: statusVal,
        batch_id: batchId,
      });
    }
  }

  const payload = [...seen.values()];
  let upserted = 0;
  const CHUNK = 200;

  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { error } = await supabaseManutencao
      .from("fact_manutencao_programada")
      .upsert(chunk, { onConflict: "equipamento,tipo_servico" });
    if (error) console.warn("[07-alinhamento] erro chunk:", error.message);
    else upserted += chunk.length;
  }

  console.log(`[07-alinhamento] ${payload.length} combinações veículo×serviço, ${upserted} upserted`);
}

if (require.main === module) {
  const batchId = randomUUID();
  runAlinhamento(batchId).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
