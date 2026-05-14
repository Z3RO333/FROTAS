import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { excelDateToIso, nullify, normFrota, normPlaca } from "./utils";

const XLSX_PATH =
  process.env.XLSX_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

// Aba "STATUS- parados"
// Row 1 (header): col1=FROTA, col2=SERVIÇOS, col3=CLASSIFICAÇÕES, col4=OFICINAS,
//   col5=PRÓXIMA PROGRAMAÇÃO, col6=OFICINAS, col7=Início em, col8=Prev. de Saída,
//   col9=Setor, col10=Status
// Dados a partir de row 2
// col1 pode ser frota_numero (número) ou placa (texto como "PHM-1144")

export async function runFrotasParadas(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const ws = wb.Sheets["STATUS- parados"];
  if (!ws) throw new Error("Aba STATUS- parados não encontrada");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const payload = [];

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const col1 = r[1];
    const col2 = r[2];

    if (col1 == null && col2 == null) continue;

    const descricao = nullify(col2);
    if (!descricao) continue;

    const col1Str = String(col1 ?? "").trim();
    const isPlaca = isNaN(Number(col1Str)) && col1Str.length > 0;

    payload.push({
      frota_numero: isPlaca ? null : normFrota(col1),
      placa: isPlaca ? normPlaca(col1) : null,
      descricao_original: descricao,
      servicos: nullify(col2),
      classificacao: nullify(r[3]),
      oficina: nullify(r[4]),
      proxima_programacao: excelDateToIso(r[5]),
      inicio_em: excelDateToIso(r[7]),
      prev_saida: excelDateToIso(r[8]),
      setor: nullify(r[9]),
      status: nullify(r[10]),
      batch_id: batchId,
    });
  }

  if (payload.length === 0) {
    console.log("[10-frotas-paradas] Nenhum registro encontrado na aba");
    return;
  }

  const { error } = await supabaseManutencao
    .from("fact_frotas_paradas")
    .insert(payload);
  if (error) throw error;

  console.log(`[10-frotas-paradas] ${payload.length} frotas paradas inseridas`);
}

if (require.main === module) {
  const batchId = randomUUID();
  runFrotasParadas(batchId)
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
