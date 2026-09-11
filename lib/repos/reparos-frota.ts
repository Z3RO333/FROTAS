import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type ReparoPrioridade = "NORMAL" | "URGENTE" | "ALTA";
export type ReparoStatus = "ABERTA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";

export type CreateReparoFrotaInput = {
  frota_id: number | null;
  numero_frota: string | null;
  placa: string | null;
  km: number;
  litros?: number | null;
  motivo_verificacao: string;
  localizacao: string;
  frota_carregada: boolean;
  prioridade: ReparoPrioridade;
  solicitante_id: string;
  solicitante_nome: string;
};

export type ReparoFrotaRow = {
  id: number;
  ticket_number: string;
  frota_id: number | null;
  numero_frota: string | null;
  placa: string | null;
  km: number;
  litros: number | null;
  motivo_verificacao: string;
  localizacao: string;
  frota_carregada: boolean;
  prioridade: ReparoPrioridade;
  solicitante_id: string;
  solicitante_nome: string | null;
  status: ReparoStatus;
  responsavel_atendimento: string | null;
  atendimento_concluido_em: string | null;
  criado_em: string;
};

const COLS_REPARO_LIST =
  "id,ticket_number,frota_id,numero_frota,placa,km,litros,motivo_verificacao,localizacao,frota_carregada,prioridade,solicitante_id,solicitante_nome,status,responsavel_atendimento,atendimento_concluido_em,criado_em";

function generateTicketNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = randomUUID().split("-")[0].toUpperCase();
  return `REP-${date}-${suffix}`;
}

export async function createReparoFrota(
  input: CreateReparoFrotaInput
): Promise<{ id: number; ticket_number: string }> {
  const ticketNumber = generateTicketNumber();
  const { data, error } = await supabaseManutencao
    .from("reparos_frota")
    .insert({
      ticket_number: ticketNumber,
      frota_id: input.frota_id,
      numero_frota: input.numero_frota,
      placa: input.placa,
      km: input.km,
      litros: input.litros ?? null,
      motivo_verificacao: input.motivo_verificacao,
      localizacao: input.localizacao,
      frota_carregada: input.frota_carregada,
      prioridade: input.prioridade,
      solicitante_id: input.solicitante_id,
      solicitante_nome: input.solicitante_nome,
      status: "ABERTA",
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: Number(data.id), ticket_number: ticketNumber };
}

export async function listReparosFrota(limit = 200): Promise<ReparoFrotaRow[]> {
  const { data, error } = await supabaseManutencao
    .from("reparos_frota")
    .select(COLS_REPARO_LIST)
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ReparoFrotaRow[];
}

export async function reparosFrotaDashboardKpis(): Promise<{
  total: number;
  abertas: number;
  prioridade_alta: number;
  concluidas: number;
}> {
  const rows = await listReparosFrota(500);
  return {
    total: rows.length,
    abertas: rows.filter((row) => row.status === "ABERTA" || row.status === "EM_ANDAMENTO").length,
    prioridade_alta: rows.filter(
      (row) => row.prioridade === "ALTA" && row.status !== "CONCLUIDA" && row.status !== "CANCELADA"
    ).length,
    concluidas: rows.filter((row) => row.status === "CONCLUIDA").length,
  };
}

export async function updateReparoFrotaStatus(
  reparoId: number,
  novoStatus: ReparoStatus,
  adminEmail: string
): Promise<void> {
  const { data: row, error: fetchError } = await supabaseManutencao
    .from("reparos_frota")
    .select("id,status,responsavel_atendimento")
    .eq("id", reparoId)
    .single();

  if (fetchError || !row) throw new Error("Solicitação de reparo não encontrada.");

  const updates: Record<string, unknown> = { status: novoStatus };

  if (row.status === "ABERTA" && novoStatus !== "ABERTA" && !row.responsavel_atendimento) {
    updates.responsavel_atendimento = adminEmail;
  }

  if (novoStatus === "CONCLUIDA" || novoStatus === "CANCELADA") {
    updates.atendimento_concluido_em = new Date().toISOString();
  }

  const { error } = await supabaseManutencao.from("reparos_frota").update(updates).eq("id", reparoId);
  if (error) throw error;
}
