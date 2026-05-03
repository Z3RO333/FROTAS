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
  operacional?: "disponivel" | "manutencao" | "indisponivel" | "baixado";
  condicao?: "normal" | "atencao" | "critico";
  cadastro?: "incompleto";
  semKm?: boolean;
  idadeMin?: number;
  vendidos?: boolean;
  page?: number;
  pageSize?: number;
};

export type Kpis = {
  total_ativos: number;
  total_disponiveis: number;
  total_indisponiveis: number;
  total_atencao: number;
  total_critico: number;
  total_manutencao: number;
  total_sem_km: number;
  total_acima_7: number;
  total_cadastro_incompleto: number;
  idade_media: number | null;
  km_medio: number | null;
};

export type FrotaInput = {
  frota_geral?: string | null;
  placa?: string | null;
  modelo?: string | null;
  chassi?: string | null;
  renavam?: string | null;
  ano_fabricacao?: number | null;
  localizacao?: string | null;
  km_atual?: number | null;
  status?: StatusFrota | null;
  observacoes?: string | null;
};

const T = "manutencao.cd.frotas";
const AGE_SQL = "(year(current_date()) - ano_fabricacao)";
const EMPTY_PLACA_SQL = "(placa IS NULL OR TRIM(placa) = '')";
const EMPTY_CHASSI_SQL = "(chassi IS NULL OR TRIM(chassi) = '')";
const CADASTRO_INCOMPLETO_SQL = `(${EMPTY_PLACA_SQL} OR ${EMPTY_CHASSI_SQL} OR km_atual IS NULL)`;
const CRITICAL_CONDITION_SQL = `(status = 'critico' OR ${AGE_SQL} >= 10)`;
const ATTENTION_CONDITION_SQL = `(status IN ('atencao', 'manutencao') OR ${AGE_SQL} >= 7 OR ${CADASTRO_INCOMPLETO_SQL})`;
const CONDITION_SQL = `(CASE
  WHEN ${CRITICAL_CONDITION_SQL} THEN 'critico'
  WHEN ${ATTENTION_CONDITION_SQL} THEN 'atencao'
  ELSE 'normal'
END)`;
const TRACKED_FIELDS = ["chassi", "km_atual", "status", "observacoes", "localizacao"] as const;
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

  wh.push(f.vendidos || f.operacional === "baixado" ? "vendido = TRUE" : "vendido = FALSE");

  if (f.search) {
    wh.push(
      "(LOWER(COALESCE(frota_geral, '')) LIKE ? OR LOWER(COALESCE(placa, '')) LIKE ? OR LOWER(COALESCE(chassi, '')) LIKE ? OR LOWER(COALESCE(modelo, '')) LIKE ? OR LOWER(COALESCE(localizacao, '')) LIKE ?)"
    );
    const q = `%${f.search.toLowerCase()}%`;
    params.push(q, q, q, q, q);
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
  if (f.operacional) {
    if (f.operacional === "disponivel") wh.push("(status IS NULL OR status NOT IN ('manutencao', 'critico', 'vendido'))");
    if (f.operacional === "manutencao") wh.push("status = 'manutencao'");
    if (f.operacional === "indisponivel") wh.push("status = 'critico'");
    if (f.operacional === "baixado") wh.push("(vendido = TRUE OR status = 'vendido')");
  }
  if (f.condicao) {
    wh.push(`${CONDITION_SQL} = ?`);
    params.push(f.condicao);
  }
  if (f.cadastro === "incompleto") {
    wh.push(CADASTRO_INCOMPLETO_SQL);
  }
  if (f.semKm) {
    wh.push("km_atual IS NULL");
  }
  if (f.idadeMin) {
    wh.push(`${AGE_SQL} >= ?`);
    params.push(f.idadeMin);
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

export async function listFrotasForReport(f: FrotaFilters = {}): Promise<Frota[]> {
  const { sql, params } = buildWhere(f);
  return query<Frota>(`SELECT * FROM ${T} WHERE ${sql} ORDER BY id`, params);
}

export async function getFrota(id: number): Promise<Frota | null> {
  const r = await query<Frota>(`SELECT * FROM ${T} WHERE id = ?`, [id]);
  return r[0] ?? null;
}

export async function kpis(): Promise<Kpis> {
  const r = await query<{
    total_ativos: number | null;
    total_disponiveis: number | null;
    total_indisponiveis: number | null;
    total_atencao: number | null;
    total_critico: number | null;
    total_manutencao: number | null;
    total_sem_km: number | null;
    total_acima_7: number | null;
    total_cadastro_incompleto: number | null;
    idade_media: number | null;
    km_medio: number | null;
  }>(
    `SELECT
      SUM(CASE WHEN ativo AND NOT vendido THEN 1 ELSE 0 END) AS total_ativos,
      SUM(CASE WHEN (status IS NULL OR status NOT IN ('manutencao', 'critico', 'vendido')) AND ativo AND NOT vendido THEN 1 ELSE 0 END) AS total_disponiveis,
      SUM(CASE WHEN status IN ('manutencao', 'critico') AND ativo AND NOT vendido THEN 1 ELSE 0 END) AS total_indisponiveis,
      SUM(CASE WHEN ${CONDITION_SQL} = 'atencao' AND ativo AND NOT vendido THEN 1 ELSE 0 END) AS total_atencao,
      SUM(CASE WHEN ${CONDITION_SQL} = 'critico' AND ativo AND NOT vendido THEN 1 ELSE 0 END) AS total_critico,
      SUM(CASE WHEN status = 'manutencao' AND ativo AND NOT vendido THEN 1 ELSE 0 END) AS total_manutencao,
      SUM(CASE WHEN km_atual IS NULL AND ativo AND NOT vendido THEN 1 ELSE 0 END) AS total_sem_km,
      SUM(CASE WHEN ${AGE_SQL} >= 7 AND ativo AND NOT vendido THEN 1 ELSE 0 END) AS total_acima_7,
      SUM(CASE WHEN ${CADASTRO_INCOMPLETO_SQL} AND ativo AND NOT vendido THEN 1 ELSE 0 END) AS total_cadastro_incompleto,
      AVG(CASE WHEN ativo AND NOT vendido THEN year(current_date()) - ano_fabricacao ELSE NULL END) AS idade_media,
      AVG(CASE WHEN ativo AND NOT vendido THEN km_atual ELSE NULL END) AS km_medio
    FROM ${T}`
  );
  const row = r[0];

  return {
    total_ativos: Number(row?.total_ativos ?? 0),
    total_disponiveis: Number(row?.total_disponiveis ?? 0),
    total_indisponiveis: Number(row?.total_indisponiveis ?? 0),
    total_atencao: Number(row?.total_atencao ?? 0),
    total_critico: Number(row?.total_critico ?? 0),
    total_manutencao: Number(row?.total_manutencao ?? 0),
    total_sem_km: Number(row?.total_sem_km ?? 0),
    total_acima_7: Number(row?.total_acima_7 ?? 0),
    total_cadastro_incompleto: Number(row?.total_cadastro_incompleto ?? 0),
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
     FROM (
       SELECT
        CASE
          WHEN status = 'manutencao' THEN 'manutencao'
          WHEN status = 'critico' THEN 'indisponivel'
          WHEN status = 'vendido' THEN 'baixado'
          ELSE 'disponivel'
        END AS status
     FROM ${T}
       WHERE ativo = TRUE AND vendido = FALSE
     ) grouped
     GROUP BY status
     ORDER BY status`
  );
  return r.map((x) => ({ status: x.status, total: Number(x.total) }));
}

export async function conditionBreakdown(): Promise<{ status: string; total: number }[]> {
  const r = await query<{ status: string; total: number }>(
    `SELECT status, COUNT(*) AS total
     FROM (
       SELECT ${CONDITION_SQL} AS status
       FROM ${T}
       WHERE ativo = TRUE AND vendido = FALSE
     ) grouped
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
      input.chassi ?? null,
      input.renavam ?? null,
      input.ano_fabricacao ?? null,
      input.localizacao ?? null,
      input.km_atual ?? null,
      input.status ?? "disponivel",
      input.observacoes ?? null,
      userEmail,
    ]
  );

  const r = await findCreatedFrota(input, userEmail);
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

async function findCreatedFrota(input: FrotaInput, userEmail: string): Promise<{ id: number }[]> {
  if (input.chassi) {
    return query<{ id: number }>(`SELECT id FROM ${T} WHERE chassi = ? ORDER BY id DESC LIMIT 1`, [
      input.chassi,
    ]);
  }
  if (input.renavam) {
    return query<{ id: number }>(`SELECT id FROM ${T} WHERE renavam = ? ORDER BY id DESC LIMIT 1`, [
      input.renavam,
    ]);
  }
  if (input.placa) {
    return query<{ id: number }>(`SELECT id FROM ${T} WHERE placa = ? ORDER BY id DESC LIMIT 1`, [
      input.placa,
    ]);
  }
  return query<{ id: number }>(
    `SELECT id FROM ${T} WHERE atualizado_por = ? ORDER BY id DESC LIMIT 1`,
    [userEmail]
  );
}
