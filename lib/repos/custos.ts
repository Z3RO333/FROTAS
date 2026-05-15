import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type CustosPeriodo = {
  data_periodo: string;
  qtd_ordens: number;
  valor_total: number;
};

export async function getCustosPorPeriodo(meses = 12): Promise<CustosPeriodo[]> {
  const { data, error } = await supabaseManutencao
    .from("fact_comparativo_ordens")
    .select("data_periodo, qtd_ordens, valor_total")
    .order("data_periodo", { ascending: false })
    .limit(meses);
  if (error) {
    console.warn("[custos] falha ao buscar ordens", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    data_periodo: String(r.data_periodo ?? ""),
    qtd_ordens: Number(r.qtd_ordens ?? 0),
    valor_total: Number(r.valor_total ?? 0),
  }));
}

export async function getCustosTotais(): Promise<{ qtd_ordens: number; valor_total: number }> {
  const periodos = await getCustosPorPeriodo(12);
  return {
    qtd_ordens: periodos.reduce((s, p) => s + p.qtd_ordens, 0),
    valor_total: periodos.reduce((s, p) => s + p.valor_total, 0),
  };
}
