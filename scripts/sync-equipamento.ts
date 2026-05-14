import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { supabaseManutencao } from "../lib/supabase-manutencao";

const XLSX_PATH =
  process.env.XLSX_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

type VeiculoEntry = {
  cod_equip: string;
  frota_numero: string | null;
  localizacao: string | null;
  ano: number | null;
  chassi: string | null;
  renavam: string | null;
};

function normPlaca(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/[\s\-]/g, "").toUpperCase();
  return s.length > 0 ? s : null;
}

function numStr(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim().replace(/[^0-9]/g, "");
  return s.length > 0 ? s : null;
}

function asInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 1900 && n < 2100 ? Math.round(n) : null;
}

function asStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function buildMap(workbook: XLSX.WorkBook): Map<string, VeiculoEntry> {
  const map = new Map<string, VeiculoEntry>();

  // ── "FROTAS BEMOLGRU TACÓGRAFO...." ──
  // Linha 1 (header): [null,"CÓD EQUIP","CARTÃO COMB","Frota Geral","PLACA","MODELO","CHASSI","RENAVAM ","ANO",...,"LOCALIZAÇÃO"=26]
  // Dados a partir de linha 2
  const sheetTacoP = workbook.Sheets["FROTAS BEMOLGRU TACÓGRAFO...."];
  if (sheetTacoP) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheetTacoP, { defval: null, header: 1 });
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] as unknown[];
      const codEquip = numStr(r[1]);
      const placa = normPlaca(r[4]);
      if (!codEquip || !placa) continue;
      if (!map.has(placa)) {
        map.set(placa, {
          cod_equip: codEquip,
          frota_numero: asStr(r[3]),
          localizacao: asStr(r[26]),
          ano: asInt(r[8]),
          chassi: asStr(r[6]),
          renavam: numStr(r[7]),
        });
      }
    }
    console.log(`  [TACÓGRAFO....] ${rows.length - 2} linhas`);
  }

  // ── "FROTAS BEMOLGRU TACÓGRAFO" (sem pontos) ──
  // Linha 0 (header): ["N DO ATIVO","CÓD EQUIP","Frota Geral","PLACA","MODELO","CHASSI","RENAVAM ","ANO",...,"LOCALIZAÇÃO"=16]
  // Dados a partir de linha 1
  const sheetTaco = workbook.Sheets["FROTAS BEMOLGRU TACÓGRAFO"];
  if (sheetTaco) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheetTaco, { defval: null, header: 1 });
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] as unknown[];
      const codEquip = numStr(r[1]);
      const placa = normPlaca(r[3]);
      if (!codEquip || !placa) continue;
      if (!map.has(placa)) {
        map.set(placa, {
          cod_equip: codEquip,
          frota_numero: asStr(r[2]),
          localizacao: asStr(r[16]),
          ano: asInt(r[7]),
          chassi: asStr(r[5]),
          renavam: numStr(r[6]),
        });
      } else {
        const e = map.get(placa)!;
        if (!e.ano) e.ano = asInt(r[7]);
        if (!e.chassi) e.chassi = asStr(r[5]);
        if (!e.renavam) e.renavam = numStr(r[6]);
        if (!e.localizacao) e.localizacao = asStr(r[16]);
      }
    }
    console.log(`  [TACÓGRAFO]     ${rows.length - 1} linhas`);
  }

  // ── "ALINHAMENTO E PREVENTIVA" ──
  // Linha 0/1 (header): ["EQUIP.","PLACAS","FROTAS","LOCAL","SETOR",...]
  // Dados a partir de linha 2
  const sheetAlin = workbook.Sheets["ALINHAMENTO E PREVENTIVA"];
  if (sheetAlin) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheetAlin, { defval: null, header: 1 });
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] as unknown[];
      const codEquip = numStr(r[0]);
      const placa = normPlaca(r[1]);
      if (!codEquip || !placa) continue;
      if (!map.has(placa)) {
        map.set(placa, {
          cod_equip: codEquip,
          frota_numero: asStr(r[2]),
          localizacao: asStr(r[3]),
          ano: null,
          chassi: null,
          renavam: null,
        });
      } else {
        const e = map.get(placa)!;
        if (!e.frota_numero) e.frota_numero = asStr(r[2]);
        if (!e.localizacao) e.localizacao = asStr(r[3]);
      }
    }
    console.log(`  [ALINHAMENTO]   ${rows.length - 2} linhas`);
  }

  return map;
}

(async () => {
  console.log(`Lendo ${XLSX_PATH}...\n`);
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));

  const equipMap = buildMap(wb);
  console.log(`\nMapa: ${equipMap.size} veículos com CÓD EQUIP\n`);

  const { data: veiculos, error } = await supabaseManutencao
    .from("veiculos")
    .select("id, placa, equipamento, local, ano_fabricacao, chassi, renavam");
  if (error) throw error;

  let updated = 0;
  let jaOk = 0;
  let semMapa = 0;
  const naoEncontrados: string[] = [];

  for (const v of veiculos ?? []) {
    const row = v as {
      id: number;
      placa: string | null;
      equipamento: string | null;
      local: string | null;
      ano_fabricacao: number | null;
      chassi: string | null;
      renavam: string | null;
    };

    const placa = normPlaca(row.placa);
    if (!placa) { semMapa++; continue; }

    const entry = equipMap.get(placa);
    if (!entry) {
      naoEncontrados.push(row.placa ?? "?");
      semMapa++;
      continue;
    }

    const patch: Record<string, unknown> = {};

    if (row.equipamento !== entry.cod_equip) patch.equipamento = entry.cod_equip;
    if (!row.local && entry.localizacao) patch.local = entry.localizacao;
    if (!row.ano_fabricacao && entry.ano) patch.ano_fabricacao = entry.ano;
    if (!row.chassi && entry.chassi) patch.chassi = entry.chassi;
    if (!row.renavam && entry.renavam) patch.renavam = entry.renavam;

    if (Object.keys(patch).length === 0) { jaOk++; continue; }

    patch.atualizado_por = "sync-equipamento";

    const { error: updateErr } = await supabaseManutencao
      .from("veiculos")
      .update(patch)
      .eq("id", row.id);

    if (updateErr) {
      console.error(`Erro id=${row.id} placa=${row.placa}:`, updateErr.message);
    } else {
      updated++;
      if (process.env.DEBUG) {
        console.log(`  ✓ ${row.placa} → equip=${entry.cod_equip} ano=${entry.ano} chassi=${entry.chassi}`);
      }
    }
  }

  console.log("────────────────────────────────");
  console.log(`Atualizados:  ${updated}`);
  console.log(`Já corretos:  ${jaOk}`);
  console.log(`Sem mapa:     ${semMapa}`);

  if (naoEncontrados.length > 0) {
    console.log(`\nPlaças não encontradas no PLANEJAMENTO (${naoEncontrados.length}):`);
    naoEncontrados.forEach((p) => console.log(`  - ${p}`));
  }

  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
