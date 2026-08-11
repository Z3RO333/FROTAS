import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type KmOrigem =
  | "CHECKLIST_INICIAL"
  | "CHECKLIST_MOTORISTA"
  | "AJUSTE_ADMIN"
  | "IMPORTACAO"
  | "OCR_HODOMETRO";

export type HistoricoKmRow = {
  id: number;
  frota_id: number;
  checklist_id: number | null;
  motorista_id: string | null;
  motorista_nome: string | null;
  km_anterior: number | null;
  km_novo: number;
  diferenca_km: number | null;
  origem: KmOrigem;
  foto_km_url: string | null;
  validado: boolean;
  validado_por: string | null;
  validado_em: string | null;
  observacao_validacao: string | null;
  criado_em: string | null;
};

export type AppendKmInput = {
  frota_id: number;
  checklist_id: number | null;
  motorista_id: string | null;
  motorista_nome: string | null;
  km_anterior: number | null;
  km_novo: number;
  origem: KmOrigem;
  foto_km_url: string | null;
  validado: boolean;
  validado_por?: string | null;
};

export async function appendKmHistory(input: AppendKmInput): Promise<number> {
  const diferenca = input.km_anterior != null ? input.km_novo - input.km_anterior : null;
  const { data, error } = await supabaseManutencao
    .from("historico_km_frota")
    .insert({
      frota_id: input.frota_id,
      checklist_id: input.checklist_id,
      motorista_id: input.motorista_id,
      motorista_nome: input.motorista_nome,
      km_anterior: input.km_anterior,
      km_novo: input.km_novo,
      diferenca_km: diferenca,
      origem: input.origem,
      foto_km_url: input.foto_km_url,
      validado: input.validado,
      validado_por: input.validado ? (input.validado_por ?? null) : null,
      validado_em: input.validado ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`appendKmHistory: ${error.message}`);
  return Number(data.id);
}

export async function listKmHistory(frotaId: number, limit = 100): Promise<HistoricoKmRow[]> {
  const { data, error } = await supabaseManutencao
    .from("historico_km_frota")
    .select("*")
    .eq("frota_id", frotaId)
    .order("criado_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listKmHistory: ${error.message}`);
  return (data ?? []) as HistoricoKmRow[];
}

