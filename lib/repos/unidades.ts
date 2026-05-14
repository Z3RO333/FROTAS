import { query, SCHEMA_FQN } from "@/lib/db";
import type { Frota } from "@/lib/repos/frotas";

const T = `${SCHEMA_FQN}.unidades_operacionais`;

export type UnidadeOperacional = {
  id: number;
  uf: string | null;
  negocio: string | null;
  loja: string | null;
  centro: string | null;
  centro_custo: string | null;
  local_negocio: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  inscricao_suframa: string | null;
  inscricao_municipal: string | null;
  cep: string | null;
  endereco: string | null;
  ie_subst_tributario: string | null;
  origem_arquivo: string | null;
  importado_em: string | null;
};

async function safeQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await query<T>(sql, params);
  } catch (error) {
    console.warn("[unidades] consulta indisponivel", error);
    return [];
  }
}

export async function listUnidades(search?: string, limit = 200): Promise<UnidadeOperacional[]> {
  const q = search?.trim().toLowerCase();
  if (!q) {
    return safeQuery<UnidadeOperacional>(
      `SELECT * FROM ${T}
       ORDER BY negocio, loja
       LIMIT ${limit}`
    );
  }

  return safeQuery<UnidadeOperacional>(
    `SELECT * FROM ${T}
     WHERE LOWER(COALESCE(loja, '')) LIKE ?
        OR LOWER(COALESCE(negocio, '')) LIKE ?
        OR LOWER(COALESCE(centro, '')) LIKE ?
        OR LOWER(COALESCE(centro_custo, '')) LIKE ?
        OR LOWER(COALESCE(cnpj, '')) LIKE ?
        OR LOWER(COALESCE(endereco, '')) LIKE ?
     ORDER BY negocio, loja
     LIMIT ${limit}`,
    [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]
  );
}

export async function countUnidades(): Promise<number> {
  const r = await safeQuery<{ n: number }>(`SELECT COUNT(*) AS n FROM ${T}`);
  return Number(r[0]?.n ?? 0);
}

export async function findUnidadeForFrota(frota: Frota): Promise<UnidadeOperacional | null> {
  const keys = [
    frota.localizacao,
    frota.frota_geral,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (keys.length === 0) return null;

  for (const key of keys) {
    const normalized = key.toLowerCase();
    const exact = await safeQuery<UnidadeOperacional>(
      `SELECT * FROM ${T}
       WHERE LOWER(COALESCE(loja, '')) = ?
          OR LOWER(COALESCE(centro, '')) = ?
          OR LOWER(COALESCE(local_negocio, '')) = ?
       LIMIT 1`,
      [normalized, normalized, normalized]
    );
    if (exact[0]) return exact[0];

    const fuzzy = await safeQuery<UnidadeOperacional>(
      `SELECT * FROM ${T}
       WHERE LOWER(COALESCE(loja, '')) LIKE ?
          OR LOWER(COALESCE(endereco, '')) LIKE ?
       ORDER BY loja
       LIMIT 1`,
      [`%${normalized}%`, `%${normalized}%`]
    );
    if (fuzzy[0]) return fuzzy[0];
  }

  return null;
}
