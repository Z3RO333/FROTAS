import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type AtualizarControleBateriaInput = {
  frotaNumero: string;
  equipamento: string | null;
  placa: string | null;
  setor: string | null;
  dataCompra: string;
  modeloBateria: string;
  loja: string;
};

export async function atualizarControleBateria(input: AtualizarControleBateriaInput): Promise<void> {
  const { data: existente, error: buscaError } = await supabaseManutencao
    .from("fact_bateria_garantia")
    .select("id")
    .eq("frota_numero", input.frotaNumero)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (buscaError) throw new Error(`atualizarControleBateria busca: ${buscaError.message}`);

  const dados = {
    placa: input.placa,
    frota_numero: input.frotaNumero,
    setor: input.setor,
    data_compra: input.dataCompra,
    modelo_bateria: input.modeloBateria,
    loja: input.loja,
  };

  if (existente) {
    const { error } = await supabaseManutencao
      .from("fact_bateria_garantia")
      .update(dados)
      .eq("id", existente.id);
    if (error) throw new Error(`atualizarControleBateria: ${error.message}`);
    return;
  }

  const { error } = await supabaseManutencao
    .from("fact_bateria_garantia")
    .upsert(
      {
        equipamento: input.equipamento ?? input.frotaNumero,
        ...dados,
        batch_id: null,
      },
      { onConflict: "equipamento" }
    );
  if (error) throw new Error(`atualizarControleBateria: ${error.message}`);
}
