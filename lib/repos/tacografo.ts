import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type TacografoStatus = "EM_DIA" | "PROXIMO_VENCIMENTO" | "VENCIDO" | "SEM_REGISTRO";

export type TacografoVeiculo = {
  veiculo_id: number;
  frota_geral: string | null;
  placa: string | null;
  localizacao: string | null;
  data_servico: string | null;
  data_proxima: string | null;
  dias_desde_servico: number | null;
  dias_para_vencer: number | null;
  status: TacografoStatus;
};

export type TacografoHistoricoRow = {
  id: number;
  veiculo_id: number;
  data_servico: string;
  data_proxima: string | null;
  observacao: string | null;
  registrado_por: string | null;
  criado_em: string;
};

// Tacógrafo: obrigação legal de aferição a cada 2 anos (730 dias)
const INTERVALO_PADRAO_DIAS = 730;
// Alerta antecipado: 60 dias antes do vencimento
const DIAS_ALERTA = 60;

function calcStatus(dataSer: string | null, dataProx: string | null): TacografoStatus {
  if (!dataSer) return "SEM_REGISTRO";
  const proxima = dataProx
    ? new Date(dataProx)
    : new Date(new Date(dataSer).getTime() + INTERVALO_PADRAO_DIAS * 86400000);
  const hoje = new Date();
  const diasParaVencer = Math.ceil((proxima.getTime() - hoje.getTime()) / 86400000);
  if (diasParaVencer < 0) return "VENCIDO";
  if (diasParaVencer <= DIAS_ALERTA) return "PROXIMO_VENCIMENTO";
  return "EM_DIA";
}

export async function listTacografoPorFrota(): Promise<TacografoVeiculo[]> {
  const { data: veiculos, error } = await supabaseManutencao
    .from("veiculos")
    .select("id, codigo_frota, placa, local")
    .eq("ativo", true)
    .eq("vendido", false);

  if (error) throw new Error(`listTacografoPorFrota: ${error.message}`);
  if (!veiculos) throw new Error("listTacografoPorFrota: resposta ausente do banco.");

  const ids = veiculos.map((v) => v.id);
  if (ids.length === 0) return [];

  const { data: historico, error: historicoError } = await supabaseManutencao
    .from("veiculo_tacografo_historico")
    .select("veiculo_id, data_servico, data_proxima")
    .in("veiculo_id", ids)
    .order("data_servico", { ascending: false });
  if (historicoError) throw new Error(`listTacografoPorFrota historico: ${historicoError.message}`);

  const ultimoPorVeiculo = new Map<number, { data_servico: string; data_proxima: string | null }>();
  for (const h of historico ?? []) {
    if (!ultimoPorVeiculo.has(Number(h.veiculo_id))) {
      ultimoPorVeiculo.set(Number(h.veiculo_id), {
        data_servico: h.data_servico,
        data_proxima: h.data_proxima ?? null,
      });
    }
  }

  const hoje = Date.now();
  return veiculos.map((v) => {
    const vid = Number(v.id);
    const ult = ultimoPorVeiculo.get(vid) ?? null;
    const proxima =
      ult?.data_proxima ??
      (ult
        ? new Date(new Date(ult.data_servico).getTime() + INTERVALO_PADRAO_DIAS * 86400000)
            .toISOString()
            .slice(0, 10)
        : null);
    const diasDesde = ult ? Math.floor((hoje - new Date(ult.data_servico).getTime()) / 86400000) : null;
    const diasPara = proxima
      ? Math.ceil((new Date(proxima).getTime() - hoje) / 86400000)
      : null;
    return {
      veiculo_id: vid,
      frota_geral: v.codigo_frota ?? null,
      placa: v.placa ?? null,
      localizacao: (v as { local?: string | null }).local ?? null,
      data_servico: ult?.data_servico ?? null,
      data_proxima: proxima,
      dias_desde_servico: diasDesde,
      dias_para_vencer: diasPara,
      status: calcStatus(ult?.data_servico ?? null, proxima),
    };
  });
}

export async function getHistoricoTacografo(veiculoId: number): Promise<TacografoHistoricoRow[]> {
  const { data, error } = await supabaseManutencao
    .from("veiculo_tacografo_historico")
    .select("*")
    .eq("veiculo_id", veiculoId)
    .order("data_servico", { ascending: false });
  if (error) throw new Error(`getHistoricoTacografo: ${error.message}`);
  return (data ?? []) as TacografoHistoricoRow[];
}

export async function registrarTacografo(input: {
  veiculo_id: number;
  data_servico: string;
  data_proxima?: string | null;
  observacao?: string | null;
  registrado_por: string;
}): Promise<void> {
  const { error } = await supabaseManutencao.from("veiculo_tacografo_historico").insert({
    veiculo_id: input.veiculo_id,
    data_servico: input.data_servico,
    data_proxima: input.data_proxima ?? null,
    observacao: input.observacao ?? null,
    registrado_por: input.registrado_por,
  });
  if (error) throw new Error(`registrarTacografo: ${error.message}`);
}
