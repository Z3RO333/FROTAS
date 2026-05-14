import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type TipoEvento =
  | "CHECKLIST_ENVIADO"
  | "KM_ALTERADO"
  | "KM_DIVERGENTE"
  | "COMBUSTIVEL_REGISTRADO"
  | "STATUS_ALTERADO"
  | "MANUTENCAO_INICIADA"
  | "MANUTENCAO_FINALIZADA"
  | "MANUTENCAO_PRORROGADA"
  | "PENDENCIA_CRIADA"
  | "PENDENCIA_RESOLVIDA"
  | "DOCUMENTO_VENCENDO"
  | "DOCUMENTO_VENCIDO"
  | "MANUTENCAO_ATRASADA"
  | "PNEU_CRITICO"
  | "ALERTA_CRIADO"
  | "ALERTA_RESOLVIDO"
  | "LIBERACAO_FORCADA";

export type Severidade = "OK" | "ATENCAO" | "CRITICO" | "MANUTENCAO" | "BLOQUEIO" | "INFO" | "NEUTRO";

export type EventoInput = {
  veiculo_id: number;
  tipo_evento: TipoEvento;
  origem: string;
  origem_id?: number | null;
  titulo: string;
  descricao?: string | null;
  severidade?: Severidade | null;
  payload?: object | null;
  usuario_id?: string | null;
};

export async function recordEvent(input: EventoInput): Promise<void> {
  const { error } = await supabaseManutencao.from("veiculo_eventos").insert({
    veiculo_id: input.veiculo_id,
    tipo_evento: input.tipo_evento,
    origem: input.origem,
    origem_id: input.origem_id ?? null,
    titulo: input.titulo,
    descricao: input.descricao ?? null,
    severidade: input.severidade ?? null,
    payload: input.payload ?? null,
    usuario_id: input.usuario_id ?? null,
  });
  if (error) console.warn("[veiculo-eventos] falha ao registrar evento", error.message);
}

export async function recordCombustivel(input: {
  veiculo_id: number;
  checklist_id?: number | null;
  litros?: number | null;
  nivel_relativo?: number | null;
  origem: string;
  usuario_id?: string | null;
}): Promise<void> {
  const { error } = await supabaseManutencao.from("veiculo_combustivel_historico").insert({
    veiculo_id: input.veiculo_id,
    checklist_id: input.checklist_id ?? null,
    litros: input.litros ?? null,
    nivel_relativo: input.nivel_relativo ?? null,
    origem: input.origem,
    usuario_id: input.usuario_id ?? null,
  });
  if (error) {
    console.warn("[veiculo-combustivel] falha", error.message);
    return;
  }

  const patch: Record<string, unknown> = {
    combustivel_atualizado_em: new Date().toISOString(),
    combustivel_origem: input.origem,
  };
  if (input.litros != null) patch.combustivel_atual_litros = input.litros;
  if (input.nivel_relativo != null) patch.combustivel_atual_nivel = input.nivel_relativo;

  await supabaseManutencao
    .from("veiculos")
    .update(patch)
    .eq("id", input.veiculo_id);
}

export type ChecklistEventInput = {
  checklist_id: number;
  veiculo_id: number;
  motorista_id: string;
  status_geral: string;
  km_anterior: number | null;
  km_novo: number;
  km_diff: number | null;
  km_validado: boolean;
  litros_combustivel?: number | null;
  nivel_combustivel?: number | null;
  nivel_arla?: number | null;
  itens_nao_aptos: number;
  itens_criticos: number;
};

export async function recordChecklistEnviado(input: ChecklistEventInput): Promise<void> {
  const severidade: Severidade =
    input.status_geral === "CRITICO"
      ? "CRITICO"
      : input.status_geral === "NAO_APTO"
        ? "CRITICO"
        : input.status_geral === "COM_OBSERVACAO"
          ? "ATENCAO"
          : "OK";

  await recordEvent({
    veiculo_id: input.veiculo_id,
    tipo_evento: "CHECKLIST_ENVIADO",
    origem: "checklist",
    origem_id: input.checklist_id,
    titulo: `Checklist ${input.status_geral.replace(/_/g, " ").toLowerCase()}`,
    descricao:
      input.itens_nao_aptos > 0
        ? `${input.itens_nao_aptos} item(s) não apto(s), ${input.itens_criticos} crítico(s)`
        : "Todos os itens aprovados",
    severidade,
    payload: {
      status_geral: input.status_geral,
      km_anterior: input.km_anterior,
      km_novo: input.km_novo,
      km_diff: input.km_diff,
      itens_nao_aptos: input.itens_nao_aptos,
      itens_criticos: input.itens_criticos,
    },
    usuario_id: input.motorista_id,
  });

  if (input.km_anterior != null && input.km_novo !== input.km_anterior) {
    const divergente = !input.km_validado;
    await recordEvent({
      veiculo_id: input.veiculo_id,
      tipo_evento: divergente ? "KM_DIVERGENTE" : "KM_ALTERADO",
      origem: "checklist",
      origem_id: input.checklist_id,
      titulo: divergente ? "KM divergente informado" : "KM atualizado",
      descricao: `${input.km_anterior?.toLocaleString("pt-BR") ?? "—"} → ${input.km_novo.toLocaleString("pt-BR")} (Δ ${input.km_diff?.toLocaleString("pt-BR") ?? "—"})`,
      severidade: divergente ? "ATENCAO" : "INFO",
      payload: {
        km_anterior: input.km_anterior,
        km_novo: input.km_novo,
        diferenca: input.km_diff,
        validado: input.km_validado,
      },
      usuario_id: input.motorista_id,
    });
  }

  if (input.litros_combustivel != null && input.litros_combustivel > 0) {
    await recordCombustivel({
      veiculo_id: input.veiculo_id,
      checklist_id: input.checklist_id,
      litros: input.litros_combustivel,
      origem: "checklist_abastecimento",
      usuario_id: input.motorista_id,
    });
    await recordEvent({
      veiculo_id: input.veiculo_id,
      tipo_evento: "COMBUSTIVEL_REGISTRADO",
      origem: "checklist",
      origem_id: input.checklist_id,
      titulo: `Abastecimento ${input.litros_combustivel} L`,
      severidade: "INFO",
      payload: { litros: input.litros_combustivel, arla: input.nivel_arla },
      usuario_id: input.motorista_id,
    });
  } else if (input.nivel_combustivel != null && input.nivel_combustivel > 0) {
    await recordCombustivel({
      veiculo_id: input.veiculo_id,
      checklist_id: input.checklist_id,
      nivel_relativo: input.nivel_combustivel,
      origem: "checklist_nivel",
      usuario_id: input.motorista_id,
    });
  }
}

export type VeiculoEventoRow = {
  id: number;
  veiculo_id: number;
  tipo_evento: TipoEvento;
  origem: string;
  origem_id: number | null;
  titulo: string;
  descricao: string | null;
  severidade: Severidade | null;
  payload: unknown;
  usuario_id: string | null;
  criado_em: string;
};

export async function listEventosByVeiculo(veiculoId: number, limit = 50): Promise<VeiculoEventoRow[]> {
  const { data, error } = await supabaseManutencao
    .from("veiculo_eventos")
    .select("*")
    .eq("veiculo_id", veiculoId)
    .order("criado_em", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[veiculo-eventos] falha listagem", error.message);
    return [];
  }
  return (data ?? []) as VeiculoEventoRow[];
}

export type CombustivelHistoricoRow = {
  id: number;
  veiculo_id: number;
  checklist_id: number | null;
  litros: number | null;
  nivel_relativo: number | null;
  origem: string;
  usuario_id: string | null;
  criado_em: string;
};

export async function listCombustivelByVeiculo(veiculoId: number, limit = 30): Promise<CombustivelHistoricoRow[]> {
  const { data, error } = await supabaseManutencao
    .from("veiculo_combustivel_historico")
    .select("*")
    .eq("veiculo_id", veiculoId)
    .order("criado_em", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as CombustivelHistoricoRow[];
}
