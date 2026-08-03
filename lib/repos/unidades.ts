import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { Frota } from "@/lib/repos/frotas";
import { safePostgrestTerm } from "@/lib/postgrest-filter";

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

async function safeSupabase<T>(label: string, cb: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await cb();
  } catch (error) {
    void fallback;
    throw new Error(`[unidades] ${label} indisponível`, { cause: error });
  }
}

export async function listUnidades(search?: string, limit = 200): Promise<UnidadeOperacional[]> {
  return safeSupabase("listagem", async () => {
    const q = search ? safePostgrestTerm(search) : "";
    let request = supabaseManutencao
      .from("unidades_operacionais")
      .select("*")
      .order("negocio", { ascending: true, nullsFirst: false })
      .order("loja", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (q) {
      const pattern = `%${q}%`;
      request = request.or([
        `loja.ilike.${pattern}`,
        `negocio.ilike.${pattern}`,
        `centro.ilike.${pattern}`,
        `centro_custo.ilike.${pattern}`,
        `cnpj.ilike.${pattern}`,
        `endereco.ilike.${pattern}`,
      ].join(","));
    }

    const { data, error } = await request;
    if (error) throw error;
    return (data ?? []) as UnidadeOperacional[];
  }, []);
}

export async function countUnidades(): Promise<number> {
  return safeSupabase("contagem", async () => {
    const { count, error } = await supabaseManutencao
      .from("unidades_operacionais")
      .select("id", { count: "exact", head: true });

    if (error) throw error;
    return count ?? 0;
  }, 0);
}

export async function findUnidadeForFrota(frota: Frota): Promise<UnidadeOperacional | null> {
  const keys = [frota.localizacao, frota.frota_geral]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (keys.length === 0) return null;

  for (const key of keys) {
    const safeKey = safePostgrestTerm(key);
    if (!safeKey) continue;
    const exact = await safeSupabase("busca exata", async () => {
      const { data, error } = await supabaseManutencao
        .from("unidades_operacionais")
        .select("*")
        .or([
          `loja.eq.${safeKey}`,
          `centro.eq.${safeKey}`,
          `local_negocio.eq.${safeKey}`,
        ].join(","))
        .limit(1);

      if (error) throw error;
      return ((data ?? []) as UnidadeOperacional[])[0] ?? null;
    }, null);

    if (exact) return exact;

    const fuzzy = await safeSupabase("busca aproximada", async () => {
      const pattern = `%${safeKey}%`;
      const { data, error } = await supabaseManutencao
        .from("unidades_operacionais")
        .select("*")
        .or(`loja.ilike.${pattern},endereco.ilike.${pattern}`)
        .order("loja", { ascending: true, nullsFirst: false })
        .limit(1);

      if (error) throw error;
      return ((data ?? []) as UnidadeOperacional[])[0] ?? null;
    }, null);

    if (fuzzy) return fuzzy;
  }

  return null;
}
