import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { calcularIdade, calcularStatus, parseVenda } from "../lib/rules";
import { supabaseManutencao } from "../lib/supabase-manutencao";

const XLSX_PATH = process.env.XLSX_PATH || "C:\\Users\\21664\\Downloads\\FROTAS 2026.xlsx";

type Row = Record<string, string | number | null | undefined> & {
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
  return text.length === 0 ? null : text;
}

function n(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLocalizacao(row: Row): string | number | null | undefined {
  const key = Object.keys(row).find((name) =>
    name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === "LOCALIZACAO"
  );
  return key ? row[key] : null;
}

async function findExisting(chassi: string | null, renavam: string | null, placa: string | null) {
  const filters = [
    chassi ? `chassi.eq.${chassi}` : null,
    renavam ? `renavam.eq.${renavam}` : null,
    placa ? `placa.eq.${placa}` : null,
  ].filter(Boolean);

  if (filters.length === 0) return null;

  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select("id")
    .or(filters.join(","))
    .order("id", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

(async () => {
  console.log(`Lendo ${XLSX_PATH}...`);
  const workbook = XLSX.read(fs.readFileSync(XLSX_PATH));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
  console.log(`${rows.length} linhas na planilha`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const anoAtual = new Date().getFullYear();

  for (const row of rows) {
    const chassi = s(row.CHASSI);
    const localizacao = s(getLocalizacao(row));
    const { vendido, anoVenda } = parseVenda(localizacao);
    const ano = n(row.ANO);
    const idade = calcularIdade(ano, anoAtual);
    const status = vendido ? "vendido" : calcularStatus(idade, null);
    const record = {
      codigo_frota: row["Frota Geral"] != null ? String(row["Frota Geral"]) : null,
      placa: s(row.PLACA),
      modelo: s(row["MODELO/ MARCA"]),
      chassi,
      renavam: row["RENAVAM "] != null ? String(row["RENAVAM "]) : null,
      ano_fabricacao: ano,
      local: localizacao,
      km_atual: null as number | null,
      status,
      observacoes: null as string | null,
      vendido,
      ano_venda: anoVenda,
      ativo: true,
      atualizado_por: "import-script",
    };

    if (!record.chassi && !record.renavam && !record.placa) {
      skipped++;
      continue;
    }

    const existing = await findExisting(record.chassi, record.renavam, record.placa);
    if (existing?.id) {
      const { error } = await supabaseManutencao
        .from("veiculos")
        .update(record)
        .eq("id", existing.id);
      if (error) throw error;
      updated++;
      continue;
    }

    const { error } = await supabaseManutencao
      .from("veiculos")
      .insert(record);
    if (error) throw error;
    inserted++;
  }

  console.log(`OK inseridas: ${inserted}, atualizadas: ${updated}, ignoradas: ${skipped}`);
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
