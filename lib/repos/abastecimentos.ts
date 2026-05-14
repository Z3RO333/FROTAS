import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type AbastecimentoOrigem = "CHECKLIST" | "ABASTECIMENTO_MANUAL" | "IMPORTACAO";

export type AbastecimentoRow = {
  id: number;
  frota_id: number;
  motorista_id: string | null;
  motorista_nome: string | null;
  checklist_id: number | null;
  data_hora: string | null;
  tipo_combustivel: string | null;
  litros_combustivel: number | null;
  litros_arla: number | null;
  km_no_abastecimento: number | null;
  foto_comprovante_url: string | null;
  origem: AbastecimentoOrigem;
  criado_em: string | null;
};

export type CreateAbastecimentoInput = {
  frota_id: number;
  motorista_id: string | null;
  motorista_nome: string | null;
  checklist_id: number | null;
  tipo_combustivel?: string | null;
  litros_combustivel?: number | null;
  litros_arla?: number | null;
  km_no_abastecimento?: number | null;
  foto_comprovante_url?: string | null;
  origem: AbastecimentoOrigem;
};

export async function createAbastecimento(input: CreateAbastecimentoInput): Promise<number> {
  const { data, error } = await supabaseManutencao
    .from("abastecimentos_frota")
    .insert({
      frota_id: input.frota_id,
      motorista_id: input.motorista_id,
      motorista_nome: input.motorista_nome,
      checklist_id: input.checklist_id,
      tipo_combustivel: input.tipo_combustivel ?? null,
      litros_combustivel: input.litros_combustivel ?? null,
      litros_arla: input.litros_arla ?? null,
      km_no_abastecimento: input.km_no_abastecimento ?? null,
      foto_comprovante_url: input.foto_comprovante_url ?? null,
      origem: input.origem,
    })
    .select("id")
    .single();
  if (error) throw new Error(`createAbastecimento: ${error.message}`);
  return Number(data.id);
}

export async function listAbastecimentosFrota(frotaId: number, limit = 50): Promise<AbastecimentoRow[]> {
  const { data, error } = await supabaseManutencao
    .from("abastecimentos_frota")
    .select("*")
    .eq("frota_id", frotaId)
    .order("data_hora", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listAbastecimentosFrota: ${error.message}`);
  return (data ?? []) as AbastecimentoRow[];
}
