import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { DemandaApp, StatusDemanda, PrioridadeDemanda } from "./types";

export async function listDemandas(status?: StatusDemanda, limit = 100): Promise<DemandaApp[]> {
  let q = supabaseManutencao
    .from("operacao_demandas_app")
    .select("id,status,descricao,tipo_movimentacao,prioridade,motorista_nome,motorista_email,id_veiculo,destino,concluido_em,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(`listDemandas: ${error.message}`);
  return (data ?? []) as DemandaApp[];
}

export async function criarDemanda(input: {
  descricao: string;
  tipo_movimentacao: string;
  prioridade: PrioridadeDemanda;
  destino?: string;
  id_veiculo?: string;
  criado_por_email: string;
  criado_por_nome: string;
}): Promise<string> {
  const { data, error } = await supabaseManutencao
    .from("operacao_demandas_app")
    .insert({
      descricao: input.descricao,
      tipo_movimentacao: input.tipo_movimentacao,
      prioridade: input.prioridade,
      destino: input.destino ?? null,
      id_veiculo: input.id_veiculo ?? null,
      criado_por_email: input.criado_por_email,
      criado_por_nome: input.criado_por_nome,
      criado_por_id: input.criado_por_email,
    })
    .select("id")
    .single();
  if (error) throw new Error(`criarDemanda: ${error.message}`);
  return data.id as string;
}

export async function atualizarStatusDemanda(
  id: string,
  status: StatusDemanda
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (status === "concluido") update.concluido_em = new Date().toISOString();
  const { error } = await supabaseManutencao
    .from("operacao_demandas_app")
    .update(update)
    .eq("id", id);
  if (error) throw new Error(`atualizarStatusDemanda: ${error.message}`);
}

export async function kpisDemandas(): Promise<Record<StatusDemanda, number>> {
  const { data, error } = await supabaseManutencao
    .from("operacao_demandas_app")
    .select("status");
  if (error) throw new Error(`kpisDemandas: ${error.message}`);
  const counts: Record<StatusDemanda, number> = { disponivel: 0, em_andamento: 0, concluido: 0, cancelado: 0 };
  for (const row of data ?? []) counts[row.status as StatusDemanda]++;
  return counts;
}
