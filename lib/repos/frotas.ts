import { query } from "@/lib/db";
import type { StatusFrota } from "@/lib/rules";

export type Frota = {
  id: number;
  frota_geral: string | null;
  placa: string | null;
  modelo: string | null;
  chassi: string | null;
  renavam: string | null;
  ano_fabricacao: number | null;
  localizacao: string | null;
  km_atual: number | null;
  status: StatusFrota | null;
  observacoes: string | null;
  vendido: boolean;
  ano_venda: number | null;
  ativo: boolean;
  criado_em: string | null;
  atualizado_em: string | null;
  atualizado_por: string | null;
};

export type FrotaFilters = {
  search?: string;
  modelo?: string;
  localizacao?: string;
  ano?: number;
  status?: StatusFrota;
  vendidos?: boolean;
  page?: number;
  pageSize?: number;
};

export type Kpis = {
  total_ativos: number;
  total_atencao: number;
  total_critico: number;
  total_manutencao: number;
  idade_media: number | null;
  km_medio: number | null;
};

const T = "manutencao.cd.frotas";

function buildWhere(f: FrotaFilters): { sql: string; params: unknown[] } {
  const wh: string[] = ["ativo = TRUE"];
  const params: unknown[] = [];

  wh.push(f.vendidos ? "vendido = TRUE" : "vendido = FALSE");

  if (f.search) {
    wh.push("(LOWER(placa) LIKE ? OR LOWER(chassi) LIKE ? OR LOWER(modelo) LIKE ?)");
    const q = `%${f.search.toLowerCase()}%`;
    params.push(q, q, q);
  }
  if (f.modelo) {
    wh.push("modelo = ?");
    params.push(f.modelo);
  }
  if (f.localizacao) {
    wh.push("localizacao = ?");
    params.push(f.localizacao);
  }
  if (f.ano) {
    wh.push("ano_fabricacao = ?");
    params.push(f.ano);
  }
  if (f.status) {
    wh.push("status = ?");
    params.push(f.status);
  }

  return { sql: wh.join(" AND "), params };
}

function pagination(f: FrotaFilters): { pageSize: number; offset: number } {
  const page = Math.max(1, Math.floor(f.page ?? 1));
  const pageSize = Math.max(1, Math.min(200, Math.floor(f.pageSize ?? 50)));
  return { pageSize, offset: (page - 1) * pageSize };
}

export async function listFrotas(
  f: FrotaFilters = {}
): Promise<{ rows: Frota[]; total: number }> {
  const { sql, params } = buildWhere(f);
  const { pageSize, offset } = pagination(f);

  const [rows, totalResult] = await Promise.all([
    query<Frota>(`SELECT * FROM ${T} WHERE ${sql} ORDER BY id LIMIT ${pageSize} OFFSET ${offset}`, params),
    query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${T} WHERE ${sql}`, params),
  ]);

  return { rows, total: Number(totalResult[0]?.n ?? 0) };
}

export async function getFrota(id: number): Promise<Frota | null> {
  const r = await query<Frota>(`SELECT * FROM ${T} WHERE id = ?`, [id]);
  return r[0] ?? null;
}

export async function kpis(): Promise<Kpis> {
  const r = await query<{
    total_ativos: number | null;
    total_atencao: number | null;
    total_critico: number | null;
    total_manutencao: number | null;
    idade_media: number | null;
    km_medio: number | null;
  }>(
    `SELECT
      SUM(CASE WHEN ativo AND NOT vendido THEN 1 ELSE 0 END) AS total_ativos,
      SUM(CASE WHEN status = 'atencao' AND ativo AND NOT vendido THEN 1 ELSE 0 END) AS total_atencao,
      SUM(CASE WHEN status = 'critico' AND ativo AND NOT vendido THEN 1 ELSE 0 END) AS total_critico,
      SUM(CASE WHEN status = 'manutencao' AND ativo AND NOT vendido THEN 1 ELSE 0 END) AS total_manutencao,
      AVG(CASE WHEN ativo AND NOT vendido THEN year(current_date()) - ano_fabricacao ELSE NULL END) AS idade_media,
      AVG(CASE WHEN ativo AND NOT vendido THEN km_atual ELSE NULL END) AS km_medio
    FROM ${T}`
  );
  const row = r[0];

  return {
    total_ativos: Number(row?.total_ativos ?? 0),
    total_atencao: Number(row?.total_atencao ?? 0),
    total_critico: Number(row?.total_critico ?? 0),
    total_manutencao: Number(row?.total_manutencao ?? 0),
    idade_media: row?.idade_media != null ? Number(row.idade_media) : null,
    km_medio: row?.km_medio != null ? Number(row.km_medio) : null,
  };
}

export async function modelosDistintos(): Promise<string[]> {
  const r = await query<{ modelo: string }>(
    `SELECT DISTINCT modelo FROM ${T} WHERE ativo = TRUE AND modelo IS NOT NULL ORDER BY modelo`
  );
  return r.map((x) => x.modelo);
}

export async function localizacoesDistintas(): Promise<string[]> {
  const r = await query<{ localizacao: string }>(
    `SELECT DISTINCT localizacao FROM ${T} WHERE ativo = TRUE AND localizacao IS NOT NULL ORDER BY localizacao`
  );
  return r.map((x) => x.localizacao);
}
