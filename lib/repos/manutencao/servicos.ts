import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { ServicoApp, TipoServico } from "./types";
import { randomUUID } from "crypto";

export const SERVICO_CONFIG: Array<{
  id: TipoServico;
  label: string;
  intervaloCampo: string;
  intervaloTipo: "km" | "dias";
  intervaloPadrao: number;
}> = [
  { id: "alinhamento",     label: "Alinhamento",     intervaloCampo: "intervalo_alinhamento_km",      intervaloTipo: "km",   intervaloPadrao: 10000 },
  { id: "balanceamento",   label: "Balanceamento",   intervaloCampo: "intervalo_alinhamento_km",      intervaloTipo: "km",   intervaloPadrao: 10000 },
  { id: "lavagem",         label: "Lavagem",          intervaloCampo: "intervalo_lavagem_dias",         intervaloTipo: "dias", intervaloPadrao: 30 },
  { id: "ar-condicionado", label: "Ar-condicionado",  intervaloCampo: "intervalo_arcondicionado_dias",  intervaloTipo: "dias", intervaloPadrao: 365 },
  { id: "tacografo",       label: "Tacógrafo",        intervaloCampo: "intervalo_tacografo_dias",       intervaloTipo: "dias", intervaloPadrao: 180 },
  { id: "portas_rool_up",  label: "Portas Rool-Up",   intervaloCampo: "intervalo_portas_rool_up_dias",  intervaloTipo: "dias", intervaloPadrao: 60 },
  { id: "embreagem",       label: "Embreagem",        intervaloCampo: "intervalo_embreagem_dias",       intervaloTipo: "dias", intervaloPadrao: 365 },
  { id: "motor",           label: "Motor",            intervaloCampo: "intervalo_motor_km",             intervaloTipo: "km",   intervaloPadrao: 20000 },
  { id: "suspensao",       label: "Suspensão",        intervaloCampo: "intervalo_suspensao_km",         intervaloTipo: "km",   intervaloPadrao: 5000 },
];

export type VeiculoServicoOption = {
  codigo_frota: string;
  placa: string | null;
};

export type VeiculoServicoStatus = VeiculoServicoOption & {
  id: number;
  equipamento: string | null;
  local: string | null;
  status: string | null;
  manutencao_motivo: string | null;
};

export type ServicoHistoricoRow = ServicoApp & {
  veiculo: {
    placa: string | null;
    intervalo_alinhamento_km: number | null;
    intervalo_suspensao_km: number | null;
    intervalo_arcondicionado_dias: number | null;
    intervalo_tacografo_dias: number | null;
    intervalo_portas_rool_up_dias: number | null;
    intervalo_embreagem_dias: number | null;
    intervalo_motor_km: number | null;
  } | null;
};

export async function listVeiculosParaServico(): Promise<VeiculoServicoOption[]> {
  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select("codigo_frota,placa")
    .eq("ativo", true)
    .eq("vendido", false)
    .order("codigo_frota");
  if (error) throw new Error(`listVeiculosParaServico: ${error.message}`);
  return (data ?? []) as VeiculoServicoOption[];
}

export async function getVeiculoParaServico(codigoFrota: string): Promise<VeiculoServicoStatus | null> {
  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select("id,codigo_frota,placa,equipamento,local,status,manutencao_motivo")
    .eq("codigo_frota", codigoFrota)
    .eq("ativo", true)
    .eq("vendido", false)
    .maybeSingle();
  if (error) throw new Error(`getVeiculoParaServico: ${error.message}`);
  return (data ?? null) as VeiculoServicoStatus | null;
}

export async function listHistoricoServico(
  tipoServico: TipoServico,
  limit = 100
): Promise<ServicoHistoricoRow[]> {
  const { data, error } = await supabaseManutencao
    .from("servicos_app")
    .select(`
      *,
      veiculo:veiculos(
        placa,
        intervalo_alinhamento_km,
        intervalo_suspensao_km,
        intervalo_arcondicionado_dias,
        intervalo_tacografo_dias,
        intervalo_portas_rool_up_dias,
        intervalo_embreagem_dias,
        intervalo_motor_km
      )
    `)
    .eq("tipo_servico", tipoServico)
    .order("data_servico", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listHistoricoServico: ${error.message}`);
  return (data ?? []) as ServicoHistoricoRow[];
}

export async function listServicosRecentes(
  limit = 100
): Promise<Array<ServicoApp & { veiculo: { placa: string | null; codigo_frota: string } | null }>> {
  const { data, error } = await supabaseManutencao
    .from("servicos_app")
    .select("*, veiculo:veiculos(codigo_frota, placa)")
    .order("data_servico", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listServicosRecentes: ${error.message}`);
  return data as Array<ServicoApp & { veiculo: { placa: string | null; codigo_frota: string } | null }>;
}

export async function listServicosByVeiculo(
  codigoFrota: string,
  limit = 20
): Promise<ServicoApp[]> {
  const { data, error } = await supabaseManutencao
    .from("servicos_app")
    .select("*")
    .eq("id_veiculo", codigoFrota)
    .order("data_servico", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listServicosByVeiculo: ${error.message}`);
  return (data ?? []) as ServicoApp[];
}

export async function registrarServico(input: {
  id_veiculo: string;
  tipo_servico: TipoServico;
  data_servico: string;
  quilometragem?: number;
  observacoes?: string;
  registrado_por_email: string;
  registrado_por_nome: string;
}): Promise<string> {
  const idServico = randomUUID();
  const { error } = await supabaseManutencao.from("servicos_app").insert({
    id_servico: idServico,
    id_veiculo: input.id_veiculo,
    tipo_servico: input.tipo_servico,
    // Meio-dia em Manaus preserva a data civil escolhida em qualquer formatação.
    data_servico: `${input.data_servico}T12:00:00-04:00`,
    quilometragem: input.quilometragem ?? null,
    observacoes: input.observacoes ?? null,
    registrado_por_email: input.registrado_por_email,
    registrado_por_nome: input.registrado_por_nome,
  });
  if (error) throw new Error(`registrarServico: ${error.message}`);
  return idServico;
}
