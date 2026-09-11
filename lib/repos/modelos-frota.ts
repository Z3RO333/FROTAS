import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type ModeloFrotaComContagem = {
  modelo: string;
  total: number;
};

/** Lista todos os modelos usados, inclusive por veículos ocultos e vendidos. */
export async function listModelosFrotaComContagem(): Promise<ModeloFrotaComContagem[]> {
  const rows: Array<{ modelo: string | null }> = [];
  const chunkSize = 1000;

  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await supabaseManutencao
      .from("veiculos")
      .select("modelo")
      .not("modelo", "is", null)
      .order("id", { ascending: true })
      .range(from, from + chunkSize - 1);
    if (error) throw new Error(`listModelosFrotaComContagem: ${error.message}`);
    const chunk = (data ?? []) as Array<{ modelo: string | null }>;
    rows.push(...chunk);
    if (chunk.length < chunkSize) break;
  }

  const contagem = new Map<string, number>();
  for (const row of rows) {
    const modelo = row.modelo?.trim();
    if (modelo) contagem.set(modelo, (contagem.get(modelo) ?? 0) + 1);
  }

  return [...contagem.entries()]
    .map(([modelo, total]) => ({ modelo, total }))
    .sort((a, b) => a.modelo.localeCompare(b.modelo, "pt-BR"));
}

/** Troca o nome em massa; usar um nome existente funde os dois grupos. */
export async function renomearModeloFrota(nomeAtual: string, nomeNovoBruto: string, userEmail: string): Promise<number> {
  const atual = nomeAtual.trim();
  const novo = nomeNovoBruto.trim();
  if (!atual) throw new Error("Modelo atual inválido.");
  if (!novo) throw new Error("Informe o modelo padronizado.");
  if (atual === novo) throw new Error("O novo nome é igual ao atual.");

  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .update({ modelo: novo, atualizado_por: userEmail })
    .eq("modelo", atual)
    .select("id");
  if (error) throw new Error(`renomearModeloFrota: ${error.message}`);
  return data?.length ?? 0;
}
