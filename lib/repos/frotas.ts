import { query } from "@/lib/db";
import type { StatusFrota } from "@/lib/rules";
import { appendHistorico } from "@/lib/repos/historico";

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

export type FrotaInput = {
  frota_geral?: string | null;
  placa?: string | null;
  modelo?: string | null;
  chassi: string;
  renavam?: string | null;
  ano_fabricacao?: number | null;
  localizacao?: string | null;
  km_atual?: number | null;
  status?: StatusFrota | null;
  observacoes?: string | null;
};

const T = "manutencao.cd.frotas";
const TRACKED_FIELDS = ["km_atual", "status", "observacoes", "localizacao"] as const;
const WRITABLE_FIELDS = [
  "frota_geral",
  "placa",
  "modelo",
  "chassi",
  "renavam",
  "ano_fabricacao",
  "localizacao",
  "km_atual",
  "status",
  "observacoes",
] as const satisfies readonly (keyof FrotaInput)[];

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

export async function statusBreakdown(): Promise<{ status: string; total: number }[]> {
  const r = await query<{ status: string; total: number }>(
    `SELECT status, COUNT(*) AS total
     FROM ${T}
     WHERE ativo = TRUE AND vendido = FALSE
     GROUP BY status
     ORDER BY status`
  );
  return r.map((x) => ({ status: x.status, total: Number(x.total) }));
}

export async function createFrota(input: FrotaInput, userEmail: string): Promise<number> {
  await query(
    `INSERT INTO ${T}
      (frota_geral, placa, modelo, chassi, renavam, ano_fabricacao, localizacao, km_atual, status, observacoes, vendido, ano_venda, ativo, criado_em, atualizado_em, atualizado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, NULL, TRUE, current_timestamp(), current_timestamp(), ?)`,
    [
      input.frota_geral ?? null,
      input.placa ?? null,
      input.modelo ?? null,
      input.chassi,
      input.renavam ?? null,
      input.ano_fabricacao ?? null,
      input.localizacao ?? null,
      input.km_atual ?? null,
      input.status ?? "disponivel",
      input.observacoes ?? null,
      userEmail,
    ]
  );

  const r = await query<{ id: number }>(
    `SELECT id FROM ${T} WHERE chassi = ? ORDER BY id DESC LIMIT 1`,
    [input.chassi]
  );
  return Number(r[0].id);
}

export async function updateFrota(
  id: number,
  input: Partial<FrotaInput>,
  userEmail: string
): Promise<void> {
  const current = await getFrota(id);
  if (!current) throw new Error(`Frota ${id} nao encontrada`);

  for (const field of TRACKED_FIELDS) {
    if (field in input) {
      const novo = input[field];
      const antigo = current[field];
      if (String(novo ?? "") !== String(antigo ?? "")) {
        await appendHistorico(
          id,
          field === "km_atual" ? "km" : field,
          String(antigo ?? ""),
          String(novo ?? ""),
          userEmail
        );
      }
    }
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const field of WRITABLE_FIELDS) {
    if (input[field] === undefined) continue;
    sets.push(`${field} = ?`);
    params.push(input[field]);
  }

  if (sets.length === 0) return;

  sets.push("atualizado_em = current_timestamp()", "atualizado_por = ?");
  params.push(userEmail, id);
  await query(`UPDATE ${T} SET ${sets.join(", ")} WHERE id = ?`, params);
}

export async function softDeleteFrota(id: number, userEmail: string): Promise<void> {
  await query(
    `UPDATE ${T} SET ativo = FALSE, atualizado_em = current_timestamp(), atualizado_por = ? WHERE id = ?`,
    [userEmail, id]
  );
}
