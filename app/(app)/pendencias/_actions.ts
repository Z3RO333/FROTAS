"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/rbac";
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { enviarFrotaParaManutencao } from "@/lib/services/veiculo-status";
import { recordEvent } from "@/lib/services/veiculo-eventos";

const PendenciaSchema = z.object({
  pendencia_id: z.coerce.number().int().positive(),
});

export type PendenciaActionResult = {
  ok: boolean;
  message: string;
};

type PendenciaActionRow = {
  id: number;
  frota_id: number;
  checklist_id: number | null;
  item_nome: string | null;
  gravidade: string;
  status: string;
};

async function getPendencia(formData: FormData): Promise<PendenciaActionRow> {
  const parsed = PendenciaSchema.parse({ pendencia_id: formData.get("pendencia_id") });
  const { data, error } = await supabaseManutencao
    .from("pendencias_frota")
    .select("id,frota_id,checklist_id,item_nome,gravidade,status")
    .eq("id", parsed.pendencia_id)
    .single();

  if (error || !data) throw new Error("Pendencia nao encontrada.");
  return data as PendenciaActionRow;
}

async function markPendencia(
  pendencia: PendenciaActionRow,
  args: { status: "EM_TRATATIVA" | "RESOLVIDA"; responsavelId: string }
) {
  const patch: Record<string, unknown> = {
    status: args.status,
    responsavel_id: args.responsavelId,
  };
  if (args.status === "RESOLVIDA") patch.resolvido_em = new Date().toISOString();

  const { error } = await supabaseManutencao
    .from("pendencias_frota")
    .update(patch)
    .eq("id", pendencia.id);

  if (error) throw error;
}

async function resolvePendenciaAtomic(pendenciaId: number, responsavelId: string, liberarFrota: boolean) {
  const { data, error } = await supabaseManutencao.rpc("resolver_pendencia_atomica", {
    p_pendencia_id: pendenciaId,
    p_responsavel_id: responsavelId,
    p_liberar_frota: liberarFrota,
  });
  if (error) throw new Error(`resolverPendencia: ${error.message}`);
  return data as {
    frota_id: number;
    bloqueios_restantes: number;
    liberada: boolean;
    em_manutencao: boolean;
  };
}

function revalidatePendenciaViews(frotaId: number) {
  revalidatePath("/pendencias");
  revalidatePath("/checklists");
  revalidatePath("/portaria");
  revalidatePath("/frotas");
  revalidatePath(`/frotas/${frotaId}`);
  revalidatePath("/relatorios/checklists");
}

function actionError(error: unknown, fallback: string): PendenciaActionResult {
  console.error("[pendencias] Falha ao executar ação", error);
  return {
    ok: false,
    message: error instanceof Error ? error.message : fallback,
  };
}

export async function resolverPendenciaAction(formData: FormData): Promise<PendenciaActionResult> {
  const user = await requireAdminUser();
  try {
    const pendencia = await getPendencia(formData);

    await resolvePendenciaAtomic(pendencia.id, user.email, false);

    revalidatePendenciaViews(pendencia.frota_id);
    return { ok: true, message: "Pendência resolvida com sucesso." };
  } catch (error) {
    return actionError(error, "Não foi possível resolver a pendência.");
  }
}

export async function liberarFrotaPendenciaAction(formData: FormData): Promise<PendenciaActionResult> {
  const user = await requireAdminUser();
  try {
    const pendencia = await getPendencia(formData);

    const result = await resolvePendenciaAtomic(pendencia.id, user.email, true);
    const bloqueiosRestantes = result.bloqueios_restantes;

    if ((bloqueiosRestantes ?? 0) > 0) {
      await recordEvent({
        veiculo_id: pendencia.frota_id,
        tipo_evento: "PENDENCIA_RESOLVIDA",
        origem: "pendencias",
        origem_id: pendencia.id,
        titulo: `Pendencia resolvida: ${pendencia.item_nome ?? "item"}`,
        descricao: `Frota mantida bloqueada por ${bloqueiosRestantes} pendência(s) crítica(s).`,
        severidade: "ATENCAO",
        payload: { bloqueios_restantes: bloqueiosRestantes },
        usuario_id: user.email,
      });
      revalidatePendenciaViews(pendencia.frota_id);
      return {
        ok: true,
        message: `Pendência resolvida. A frota continua bloqueada por ${bloqueiosRestantes} pendência(s) crítica(s).`,
      };
    }

    if (!result.liberada) {
      if (result.em_manutencao) throw new Error("Pendência resolvida, mas a frota permanece em manutenção e não foi liberada.");
      throw new Error("Pendência resolvida, mas o estado da frota não permitiu a liberação.");
    }

    await recordEvent({
      veiculo_id: pendencia.frota_id,
      tipo_evento: "LIBERACAO_FORCADA",
      origem: "pendencias",
      origem_id: pendencia.id,
      titulo: `Frota liberada com pendência: ${pendencia.item_nome ?? "item"}`,
      descricao: "Liberação manual feita pela administração.",
      severidade: "ATENCAO",
      payload: { gravidade: pendencia.gravidade, checklist_id: pendencia.checklist_id },
      usuario_id: user.email,
    });

    revalidatePendenciaViews(pendencia.frota_id);
    return { ok: true, message: "Pendência resolvida e frota liberada." };
  } catch (error) {
    return actionError(error, "Não foi possível liberar a frota.");
  }
}

export async function abrirManutencaoPendenciaAction(formData: FormData): Promise<PendenciaActionResult> {
  const user = await requireAdminUser();
  try {
    const pendencia = await getPendencia(formData);

    if (pendencia.status !== "ABERTA") {
      throw new Error("Esta pendência já está em tratativa ou foi encerrada.");
    }

    const result = await enviarFrotaParaManutencao({
      frotaId: pendencia.frota_id,
      motivo: `Pendência de checklist: ${pendencia.item_nome ?? "item não conforme"}`,
      tipo: pendencia.gravidade === "CRITICA" ? "EMERGENCIAL" : "CORRETIVA",
      observacao: `Aberta a partir da pendência #${pendencia.id}.`,
      bloqueiaChecklist: true,
      destino: "CORRETIVA",
      usuarioEmail: user.email,
    });

    if (!result.ok) throw new Error(result.error);

    await markPendencia(pendencia, { status: "EM_TRATATIVA", responsavelId: user.email });
    revalidatePendenciaViews(pendencia.frota_id);
    revalidatePath("/planejamento/paradas");
    revalidatePath("/manutencao");
    return { ok: true, message: "Frota enviada para manutenção." };
  } catch (error) {
    return actionError(error, "Não foi possível abrir a manutenção.");
  }
}
