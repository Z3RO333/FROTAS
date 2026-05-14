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
  { id: "lavagem",         label: "Lavagem",          intervaloCampo: "intervalo_lavagem_dias",         intervaloTipo: "dias", intervaloPadrao: 30 },
  { id: "ar-condicionado", label: "Ar-condicionado",  intervaloCampo: "intervalo_arcondicionado_dias",  intervaloTipo: "dias", intervaloPadrao: 365 },
  { id: "tacografo",       label: "Tacógrafo",        intervaloCampo: "intervalo_tacografo_dias",       intervaloTipo: "dias", intervaloPadrao: 180 },
  { id: "portas_rool_up",  label: "Portas Rool-Up",   intervaloCampo: "intervalo_portas_rool_up_dias",  intervaloTipo: "dias", intervaloPadrao: 60 },
  { id: "embreagem",       label: "Embreagem",        intervaloCampo: "intervalo_embreagem_dias",       intervaloTipo: "dias", intervaloPadrao: 365 },
  { id: "motor",           label: "Motor",            intervaloCampo: "intervalo_motor_km",             intervaloTipo: "km",   intervaloPadrao: 20000 },
  { id: "suspensao",       label: "Suspensão",        intervaloCampo: "intervalo_suspensao_km",         intervaloTipo: "km",   intervaloPadrao: 5000 },
];

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

export async function registrarServico(input: {
  id_veiculo: string;
  tipo_servico: TipoServico;
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
    quilometragem: input.quilometragem ?? null,
    observacoes: input.observacoes ?? null,
    registrado_por_email: input.registrado_por_email,
    registrado_por_nome: input.registrado_por_nome,
  });
  if (error) throw new Error(`registrarServico: ${error.message}`);
  return idServico;
}
