import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { recordEvent } from "@/lib/services/veiculo-eventos";
import type { StatusFrota } from "@/lib/rules";

export type StatusOperacional =
  | "DISPONIVEL"
  | "EM_USO"
  | "CHECKLIST_PENDENTE"
  | "BLOQUEADA_CHECKLIST"
  | "EM_MANUTENCAO"
  | "INDISPONIVEL"
  | "VENDIDO"
  | "LIBERADA"
  | "PENDENTE_ANALISE";

export type TipoManutencao = "PREVENTIVA" | "CORRETIVA" | "EMERGENCIAL" | "OUTRA";

export type DestinoManutencao =
  | "OFICINA"
  | "LAVAGEM"
  | "PREVENTIVA"
  | "CORRETIVA"
  | "ALINHAMENTO"
  | "AR_CONDICIONADO"
  | "TACOGRAFO"
  | "OUTRO";

export type EnviarManutencaoInput = {
  frotaId: number;
  motivo: string;
  tipo: TipoManutencao;
  oficina?: string | null;
  prevRetorno?: string | null;
  observacao?: string | null;
  bloqueiaChecklist?: boolean;
  destino?: DestinoManutencao | null;
  destino_detalhe?: string | null;
  usuarioEmail: string;
};

export type RetornarOperacaoInput = {
  frotaId: number;
  observacao: string;
  kmAtual?: number | null;
  forcarLiberacao?: boolean;
  justificativaForcada?: string | null;
  usuarioEmail: string;
};

export type DisponibilidadeResult = {
  disponivel: boolean;
  motivos: Array<{ tipo: "MANUTENCAO" | "CHECKLIST" | "VENDIDO" | "BAIXADA" | "STATUS"; descricao: string }>;
};

type FrotaSnapshot = {
  id: number;
  status: StatusFrota | null;
  status_operacional: string | null;
  ativo: boolean;
  vendido: boolean;
  manutencao_motivo: string | null;
  manutencao_iniciado_em: string | null;
  manutencao_prev_retorno: string | null;
  manutencao_bloqueia_checklist: boolean | null;
};

async function getSnapshot(frotaId: number): Promise<FrotaSnapshot | null> {
  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select(
      "id,status,status_operacional,ativo,vendido,manutencao_motivo,manutencao_iniciado_em,manutencao_prev_retorno,manutencao_bloqueia_checklist"
    )
    .eq("id", frotaId)
    .single();
  if (error || !data) return null;
  return data as FrotaSnapshot;
}

/**
 * Verifica se uma frota pode realizar uma operação (saída, checklist, etc).
 * Não consulta pendências/documentos — apenas o estado direto do veículo.
 */
export async function verificarDisponibilidadeFrota(
  frotaId: number
): Promise<DisponibilidadeResult> {
  const f = await getSnapshot(frotaId);
  if (!f) return { disponivel: false, motivos: [{ tipo: "STATUS", descricao: "Frota não encontrada" }] };

  const motivos: DisponibilidadeResult["motivos"] = [];

  if (f.vendido) motivos.push({ tipo: "VENDIDO", descricao: "Frota vendida" });
  if (!f.ativo) motivos.push({ tipo: "BAIXADA", descricao: "Frota baixada/inativa" });

  if (f.status === "manutencao" && f.manutencao_bloqueia_checklist) {
    motivos.push({
      tipo: "MANUTENCAO",
      descricao: f.manutencao_motivo
        ? `Em manutenção: ${f.manutencao_motivo}`
        : "Em manutenção",
    });
  }

  if (f.status_operacional === "BLOQUEADA_CHECKLIST") {
    motivos.push({ tipo: "CHECKLIST", descricao: "Bloqueada por checklist crítico" });
  }

  return { disponivel: motivos.length === 0, motivos };
}

/**
 * Envia uma frota para manutenção, registrando o evento e atualizando todos os campos.
 */
export async function enviarFrotaParaManutencao(
  input: EnviarManutencaoInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.motivo?.trim()) return { ok: false, error: "Motivo é obrigatório." };

  const f = await getSnapshot(input.frotaId);
  if (!f) return { ok: false, error: "Frota não encontrada." };
  if (f.vendido) return { ok: false, error: "Frota vendida não pode entrar em manutenção." };
  if (f.status === "manutencao") return { ok: false, error: "Frota já está em manutenção." };

  const statusAnterior = f.status;
  const statusOpAnterior = f.status_operacional;
  const agora = new Date().toISOString();

  const { data: updated, error: updateErr } = await supabaseManutencao
    .from("veiculos")
    .update({
      status: "manutencao",
      status_operacional: "EM_MANUTENCAO",
      manutencao_motivo: input.motivo.trim(),
      manutencao_tipo: input.tipo,
      manutencao_oficina: input.oficina?.trim() || null,
      manutencao_prev_retorno: input.prevRetorno || null,
      manutencao_observacao: input.observacao?.trim() || null,
      manutencao_destino: input.destino ?? null,
      manutencao_destino_detalhe: input.destino_detalhe?.trim() || null,
      manutencao_iniciado_em: agora,
      manutencao_iniciado_por: input.usuarioEmail,
      manutencao_bloqueia_checklist: input.bloqueiaChecklist ?? true,
      atualizado_por: input.usuarioEmail,
    })
    .eq("id", input.frotaId)
    .neq("status", "manutencao")
    .select("id")
    .maybeSingle();

  if (updateErr) return { ok: false, error: updateErr.message };
  if (!updated) return { ok: false, error: "A frota foi alterada por outro usuário. Atualize a tela." };

  await recordEvent({
    veiculo_id: input.frotaId,
    tipo_evento: "MANUTENCAO_INICIADA",
    origem: "manutencao_manual",
    titulo: `Frota enviada para manutenção (${input.tipo})`,
    descricao: input.motivo,
    severidade: "MANUTENCAO",
    payload: {
      tipo: input.tipo,
      oficina: input.oficina,
      prev_retorno: input.prevRetorno,
      observacao: input.observacao,
      bloqueia_checklist: input.bloqueiaChecklist ?? true,
      status_anterior: statusAnterior,
      status_op_anterior: statusOpAnterior,
    },
    usuario_id: input.usuarioEmail,
  });

  await recordEvent({
    veiculo_id: input.frotaId,
    tipo_evento: "STATUS_ALTERADO",
    origem: "manutencao_manual",
    titulo: `Status: ${statusAnterior ?? "—"} → manutencao`,
    descricao: input.motivo,
    severidade: "MANUTENCAO",
    payload: { de: statusAnterior, para: "manutencao" },
    usuario_id: input.usuarioEmail,
  });

  return { ok: true };
}

/**
 * Retorna a frota para operação, validando pendências.
 * Se houver bloqueios, exige forcarLiberacao + justificativa.
 */
export async function retornarFrotaParaOperacao(
  input: RetornarOperacaoInput
): Promise<{ ok: true } | { ok: false; error: string; bloqueios?: string[] }> {
  if (!input.observacao?.trim()) return { ok: false, error: "Observação é obrigatória." };

  const f = await getSnapshot(input.frotaId);
  if (!f) return { ok: false, error: "Frota não encontrada." };
  if (f.status !== "manutencao")
    return { ok: false, error: "Esta frota não está em manutenção." };

  // Validar pendências críticas abertas
  const bloqueios: string[] = [];

  const { count: pendCriticas, error: pendCriticasError } = await supabaseManutencao
    .from("pendencias_frota")
    .select("id", { count: "exact", head: true })
    .eq("frota_id", input.frotaId)
    .eq("gravidade", "CRITICA")
    .in("status", ["ABERTA", "EM_TRATATIVA"]);

  if (pendCriticasError) {
    return {
      ok: false,
      error: "Não foi possível validar as pendências críticas. A liberação foi bloqueada.",
    };
  }

  if ((pendCriticas ?? 0) > 0) {
    bloqueios.push(`${pendCriticas} pendência(s) crítica(s) aberta(s)`);
  }

  if (bloqueios.length > 0 && !input.forcarLiberacao) {
    return {
      ok: false,
      error: "Existem pendências críticas. Use liberação forçada com justificativa.",
      bloqueios,
    };
  }

  if (bloqueios.length > 0 && !input.justificativaForcada?.trim()) {
    return { ok: false, error: "Justificativa é obrigatória para liberação forçada.", bloqueios };
  }

  const agora = new Date().toISOString();
  const inicio = f.manutencao_iniciado_em ? new Date(f.manutencao_iniciado_em) : null;
  const duracaoDias = inicio
    ? Math.floor((Date.now() - inicio.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const patch: Record<string, unknown> = {
    status: "disponivel",
    status_operacional: "DISPONIVEL",
    manutencao_motivo: null,
    manutencao_tipo: null,
    manutencao_oficina: null,
    manutencao_prev_retorno: null,
    manutencao_observacao: null,
    manutencao_iniciado_em: null,
    manutencao_iniciado_por: null,
    manutencao_bloqueia_checklist: null,
    atualizado_por: input.usuarioEmail,
  };
  if (input.kmAtual != null && input.kmAtual > 0) {
    patch.km_atual = input.kmAtual;
    patch.km_atualizado_em = agora;
    patch.km_origem = "MANUTENCAO_RETORNO";
  }

  const { data: updated, error: updateErr } = await supabaseManutencao
    .from("veiculos")
    .update(patch)
    .eq("id", input.frotaId)
    .eq("status", "manutencao")
    .select("id")
    .maybeSingle();

  if (updateErr) return { ok: false, error: updateErr.message };
  if (!updated) return { ok: false, error: "A frota foi alterada por outro usuário. Atualize a tela." };

  await recordEvent({
    veiculo_id: input.frotaId,
    tipo_evento: "MANUTENCAO_FINALIZADA",
    origem: "manutencao_manual",
    titulo:
      duracaoDias != null
        ? `Retornou à operação após ${duracaoDias} dia(s)`
        : "Retornou à operação",
    descricao: input.observacao,
    severidade: "OK",
    payload: {
      duracao_dias: duracaoDias,
      forcada: input.forcarLiberacao ?? false,
      justificativa_forcada: input.justificativaForcada ?? null,
      bloqueios,
      km_atual: input.kmAtual ?? null,
    },
    usuario_id: input.usuarioEmail,
  });

  await recordEvent({
    veiculo_id: input.frotaId,
    tipo_evento: "STATUS_ALTERADO",
    origem: "manutencao_manual",
    titulo: "Status: manutencao → disponivel",
    severidade: "OK",
    payload: { de: "manutencao", para: "disponivel" },
    usuario_id: input.usuarioEmail,
  });

  if (input.forcarLiberacao && bloqueios.length > 0) {
    await recordEvent({
      veiculo_id: input.frotaId,
      tipo_evento: "LIBERACAO_FORCADA",
      origem: "manutencao_manual",
      titulo: "Liberação forçada com pendências críticas",
      descricao: input.justificativaForcada,
      severidade: "ATENCAO",
      payload: { bloqueios, justificativa: input.justificativaForcada },
      usuario_id: input.usuarioEmail,
    });
  }

  return { ok: true };
}
