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

export type HistoricoKmComFrota = HistoricoKmRow & {
  frota_geral: string | null;
  placa: string | null;
  modelo: string | null;
  km_atual_frota: number | null;
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

function withFrota(row: HistoricoKmRow & { veiculos?: { codigo_frota?: string | null; placa?: string | null; modelo?: string | null; km_atual?: number | null } | null }): HistoricoKmComFrota {
  return {
    ...row,
    frota_geral: row.veiculos?.codigo_frota ?? null,
    placa: row.veiculos?.placa ?? null,
    modelo: row.veiculos?.modelo ?? null,
    km_atual_frota: row.veiculos?.km_atual != null ? Number(row.veiculos.km_atual) : null,
  };
}

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

export async function listPendingKmValidations(limit = 100): Promise<HistoricoKmComFrota[]> {
  const { data, error } = await supabaseManutencao
    .from("historico_km_frota")
    .select("*, veiculos(codigo_frota, placa, modelo, km_atual)")
    .eq("validado", false)
    .order("criado_em", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listPendingKmValidations: ${error.message}`);
  return ((data ?? []) as Array<HistoricoKmRow & { veiculos?: { codigo_frota?: string | null; placa?: string | null; modelo?: string | null; km_atual?: number | null } | null }>).map(withFrota);
}

export async function getKmEntry(id: number): Promise<HistoricoKmComFrota | null> {
  const { data, error } = await supabaseManutencao
    .from("historico_km_frota")
    .select("*, veiculos(codigo_frota, placa, modelo, km_atual)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getKmEntry: ${error.message}`);
  return data ? withFrota(data as HistoricoKmRow & { veiculos?: { codigo_frota?: string | null; placa?: string | null; modelo?: string | null; km_atual?: number | null } | null }) : null;
}

export async function approveKmEntry(id: number, validadoPor: string, observacao?: string | null): Promise<void> {
  const { error } = await supabaseManutencao
    .from("historico_km_frota")
    .update({
      validado: true,
      validado_por: validadoPor,
      validado_em: new Date().toISOString(),
      observacao_validacao: observacao ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(`approveKmEntry: ${error.message}`);
}

export async function correctKmEntry(id: number, kmCorrigido: number, validadoPor: string, observacao: string): Promise<void> {
  const current = await getKmEntry(id);
  const diferenca = current?.km_anterior != null ? kmCorrigido - current.km_anterior : null;
  const { error } = await supabaseManutencao
    .from("historico_km_frota")
    .update({
      km_novo: kmCorrigido,
      diferenca_km: diferenca,
      validado: true,
      validado_por: validadoPor,
      validado_em: new Date().toISOString(),
      observacao_validacao: observacao,
    })
    .eq("id", id);
  if (error) throw new Error(`correctKmEntry: ${error.message}`);
}

export async function countPendingKmValidations(): Promise<number> {
  const { count, error } = await supabaseManutencao
    .from("historico_km_frota")
    .select("id", { count: "exact", head: true })
    .eq("validado", false);
  if (error) throw new Error(`countPendingKmValidations: ${error.message}`);
  return count ?? 0;
}
