import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { supabaseManutencao } from "../lib/supabase-manutencao";

const XLSX_PATH = process.env.XLSX_PATH || "C:\\Users\\21664\\Downloads\\FROTAS 2026.xlsx";

type Row = Record<string, unknown> & {
  "Frota Geral"?: string | number;
  PLACA?: string;
  "MODELO/ MARCA"?: string;
  CHASSI?: string;
  "RENAVAM "?: string | number;
  ANO?: string | number;
};

function s(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function n(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCol(row: Row, name: string): unknown {
  const key = Object.keys(row).find(
    (k) => k.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase() === name
  );
  return key ? row[key] : null;
}

function normalizePlaca(placa: string | null): string | null {
  if (!placa) return null;
  return placa.replace(/[\s\-]/g, "").toUpperCase();
}

(async () => {
  console.log(`Lendo ${XLSX_PATH}...`);
  const workbook = XLSX.read(fs.readFileSync(XLSX_PATH));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
  console.log(`${rows.length} linhas na planilha`);

  const { data: veiculos, error: fetchError } = await supabaseManutencao
    .from("veiculos")
    .select("id, placa, chassi, codigo_frota");

  if (fetchError) throw fetchError;

  const byPlaca = new Map<string, { id: number; placa: string | null; chassi: string | null; codigo_frota: string | null }>();
  const byChassi = new Map<string, { id: number; placa: string | null; chassi: string | null; codigo_frota: string | null }>();

  for (const v of veiculos ?? []) {
    const row = v as { id: number; placa: string | null; chassi: string | null; codigo_frota: string | null };
    const placa = normalizePlaca(row.placa);
    if (placa) byPlaca.set(placa, row);
    if (row.chassi) byChassi.set(row.chassi.trim().toUpperCase(), row);
  }

  let updated = 0;
  let inserted = 0;
  let skipped = 0;
  const notFound: string[] = [];

  for (const row of rows) {
    const placa = s(row.PLACA);
    const chassi = s(row.CHASSI);
    const renavam = row["RENAVAM "] != null ? String(row["RENAVAM "]).trim() : null;
    const ano = n(row.ANO);
    const modelo = s(row["MODELO/ MARCA"]);
    const localizacao = s(getCol(row, "LOCALIZACAO"));

    if (!placa && !chassi) {
      skipped++;
      continue;
    }

    const match =
      byPlaca.get(normalizePlaca(placa) ?? "") ??
      (chassi ? byChassi.get(chassi.toUpperCase()) : undefined);

    if (match) {
      const patch: Record<string, unknown> = {};
      if (ano != null) patch.ano_fabricacao = ano;
      if (chassi) patch.chassi = chassi;
      if (renavam) patch.renavam = renavam;
      if (localizacao) patch.local = localizacao;
      if (modelo) patch.modelo = modelo;
      patch.atualizado_por = "enrich-xlsx";

      const { error } = await supabaseManutencao
        .from("veiculos")
        .update(patch)
        .eq("id", match.id);
      if (error) {
        console.error(`Erro ao atualizar id=${match.id} placa=${placa}:`, error.message);
        continue;
      }
      updated++;
    } else {
      // Inserir novo veículo — usa placa como codigo_frota se não houver outro identificador
      const codigoFrota = placa ?? (chassi ? chassi.slice(-6) : null);
      if (!codigoFrota) { skipped++; continue; }

      const { error } = await supabaseManutencao.from("veiculos").insert({
        codigo_frota: codigoFrota,
        placa,
        modelo,
        chassi,
        renavam,
        ano_fabricacao: ano,
        local: localizacao,
        ativo: true,
        vendido: false,
        status: "disponivel",
        atualizado_por: "enrich-xlsx",
      });

      if (error) {
        console.error(`Erro ao inserir placa=${placa}:`, error.message);
        notFound.push(`${placa ?? chassi ?? "?"} (ERRO: ${error.message})`);
        skipped++;
      } else {
        inserted++;
      }
    }
  }

  console.log(`\nResultado:`);
  console.log(`  Atualizados: ${updated}`);
  console.log(`  Inseridos:   ${inserted}`);
  console.log(`  Ignorados:   ${skipped}`);

  if (notFound.length > 0) {
    console.log(`\nNão encontrados no banco (${notFound.length}):`);
    notFound.forEach((p) => console.log(`  - ${p}`));
  }

  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
