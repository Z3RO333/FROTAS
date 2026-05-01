import "dotenv/config";
import * as XLSX from "xlsx";
import { query, execute } from "../lib/db";
import { calcularIdade, calcularStatus, parseVenda } from "../lib/rules";

const XLSX_PATH = process.env.XLSX_PATH || "C:\\Users\\21664\\Downloads\\FROTAS 2026.xlsx";

type Row = Record<string, string | number | null | undefined> & {
  "Frota Geral"?: string | number;
  PLACA?: string;
  "MODELO/ MARCA"?: string;
  CHASSI?: string;
  "RENAVAM "?: string | number;
  ANO?: string | number;
};

function s(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
}

function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function getLocalizacao(row: Row): string | number | null | undefined {
  const key = Object.keys(row).find((k) =>
    k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === "LOCALIZACAO"
  );
  return key ? row[key] : null;
}

(async () => {
  console.log(`Lendo ${XLSX_PATH}...`);
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
  console.log(`${rows.length} linhas na planilha`);

  let inserted = 0, updated = 0, skipped = 0;
  const ano_atual = new Date().getFullYear();

  for (const r of rows) {
    const chassi = s(r.CHASSI);
    const localizacao = s(getLocalizacao(r));
    const { vendido, anoVenda } = parseVenda(localizacao);
    const ano = n(r.ANO);
    const idade = calcularIdade(ano, ano_atual);
    const status = vendido ? "vendido" : calcularStatus(idade, null);
    const cols = {
      frota_geral: r["Frota Geral"] != null ? String(r["Frota Geral"]) : null,
      placa: s(r.PLACA),
      modelo: s(r["MODELO/ MARCA"]),
      chassi,
      renavam: r["RENAVAM "] != null ? String(r["RENAVAM "]) : null,
      ano_fabricacao: ano,
      localizacao,
      km_atual: null as number | null,
      status,
      observacoes: null as string | null,
      vendido,
      ano_venda: anoVenda,
      ativo: true,
      atualizado_por: "import-script",
    };

    const existing = await findExisting(cols.chassi, cols.renavam, cols.placa);
    if (!cols.chassi && !cols.renavam && !cols.placa) {
      skipped++;
      continue;
    }

    if (existing.length > 0) {
      await execute(
        `UPDATE manutencao.cd.frotas SET
          frota_geral=?, placa=?, modelo=?, chassi=COALESCE(?, chassi), renavam=?, ano_fabricacao=?, localizacao=?,
          status=?, vendido=?, ano_venda=?, ativo=?, atualizado_em=current_timestamp(), atualizado_por=?
         WHERE id=?`,
        [
          cols.frota_geral,
          cols.placa,
          cols.modelo,
          cols.chassi,
          cols.renavam,
          cols.ano_fabricacao,
          cols.localizacao,
          cols.status,
          cols.vendido,
          cols.ano_venda,
          cols.ativo,
          cols.atualizado_por,
          existing[0].id,
        ]
      );
      updated++;
    } else {
      await execute(
        `INSERT INTO manutencao.cd.frotas
          (frota_geral, placa, modelo, chassi, renavam, ano_fabricacao, localizacao, km_atual, status, observacoes, vendido, ano_venda, ativo, criado_em, atualizado_em, atualizado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, current_timestamp(), current_timestamp(), ?)`,
        [
          cols.frota_geral,
          cols.placa,
          cols.modelo,
          cols.chassi,
          cols.renavam,
          cols.ano_fabricacao,
          cols.localizacao,
          cols.km_atual,
          cols.status,
          cols.observacoes,
          cols.vendido,
          cols.ano_venda,
          cols.ativo,
          cols.atualizado_por,
        ]
      );
      inserted++;
    }
  }

  console.log(`OK Inseridas: ${inserted}, atualizadas: ${updated}, ignoradas: ${skipped}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function findExisting(
  chassi: string | null,
  renavam: string | null,
  placa: string | null
): Promise<{ id: number }[]> {
  if (chassi) {
    return query<{ id: number }>(`SELECT id FROM manutencao.cd.frotas WHERE chassi = ?`, [chassi]);
  }
  if (renavam) {
    return query<{ id: number }>(`SELECT id FROM manutencao.cd.frotas WHERE renavam = ?`, [renavam]);
  }
  if (placa) {
    return query<{ id: number }>(`SELECT id FROM manutencao.cd.frotas WHERE placa = ?`, [placa]);
  }
  return [];
}
