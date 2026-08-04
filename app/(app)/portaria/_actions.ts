"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { listPortariaToday, registrarMovimentacaoFrota, type StatusPortaria } from "@/lib/repos/checklists";
import { canApprovePortariaExit, requireAppUser, requirePortariaUser } from "@/lib/rbac";
import { publicActionError } from "@/lib/public-error";

// Checklist pendente/crítico não bloqueia mais a saída — vira só um indicador visual pra portaria.
// Só bloqueia mesmo quando a frota está em manutenção ou já teve movimentação registrada hoje.
const NAO_LIBERA_SAIDA: readonly StatusPortaria[] = ["BLOQUEADA_MANUTENCAO", "SAIDA_REGISTRADA", "ENTRADA_REGISTRADA"];

const MovimentoSchema = z.object({
  frota_id: z.coerce.number().int().positive(),
  checklist_id: z.coerce.number().int().positive(),
  tipo_movimentacao: z.literal("SAIDA"),
  observacao: z.string().trim().optional().nullable(),
});

function formObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    obj[key] = value === "" ? null : value;
  }
  return obj;
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function registrarMovimentacaoPortariaAction(formData: FormData) {
  try {
    const user = await requirePortariaUser();
    const parsed = MovimentoSchema.parse(formObject(formData));
    const rows = await listPortariaToday();
    const row = rows.find(
      (item) => item.frota_id === parsed.frota_id && item.checklist_id === parsed.checklist_id
    );

    if (!row || !row.checklist_id || !row.motorista_id) {
      redirect(`/portaria?erro=${encodeURIComponent("Checklist válido de hoje não encontrado para esta frota.")}`);
    }

    if (NAO_LIBERA_SAIDA.includes(row.status_portaria)) {
      redirect(`/portaria?erro=${encodeURIComponent("Saída bloqueada: frota em manutenção ou já com movimentação registrada hoje.")}`);
    }

    await registrarMovimentacaoFrota({
      frota_id: parsed.frota_id,
      checklist_id: parsed.checklist_id,
      motorista_id: row.motorista_id,
      tipo_movimentacao: parsed.tipo_movimentacao,
      usuario_portaria_id: user.email,
      observacao: parsed.observacao,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const msg = error instanceof z.ZodError
      ? error.issues[0]?.message ?? "Dados inválidos."
      : publicActionError(error, "Não foi possível registrar a movimentação.");
    redirect(`/portaria?erro=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/portaria");
}

export async function bloquearSaidaAction(formData: FormData) {
  try {
    const user = await requirePortariaUser();
    const frotaId = Number(formData.get("frota_id"));
    const checklistId = Number(formData.get("checklist_id"));
    const motivo = String(formData.get("motivo") ?? "").trim();

    if (!Number.isInteger(frotaId) || frotaId <= 0 || !Number.isInteger(checklistId) || checklistId <= 0) {
      redirect(`/portaria?erro=${encodeURIComponent("IDs inválidos.")}`);
    }
    if (!motivo) redirect(`/portaria?erro=${encodeURIComponent("Informe o motivo do bloqueio.")}`);

    const rows = await listPortariaToday();
    const row = rows.find((r) => r.frota_id === frotaId && r.checklist_id === checklistId);
    if (!row || !row.motorista_id) {
      redirect(`/portaria?erro=${encodeURIComponent("Frota não encontrada.")}`);
    }
    if (NAO_LIBERA_SAIDA.includes(row.status_portaria)) {
      redirect(`/portaria?erro=${encodeURIComponent("O bloqueio manual só pode ser registrado para uma frota que poderia sair.")}`);
    }

    await registrarMovimentacaoFrota({
      frota_id: frotaId,
      checklist_id: checklistId,
      motorista_id: row!.motorista_id!,
      tipo_movimentacao: "SAIDA",
      usuario_portaria_id: user.email,
      observacao: motivo,
      tipo_acao: "BLOQUEIO",
      motivo_bloqueio: motivo,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const msg = publicActionError(error, "Erro ao bloquear saída.");
    redirect(`/portaria?erro=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/portaria");
}

export async function solicitarCorrecaoAction(formData: FormData) {
  try {
    const user = await requirePortariaUser();
    const frotaId = Number(formData.get("frota_id"));
    const checklistId = Number(formData.get("checklist_id"));
    const motivo = String(formData.get("motivo") ?? "").trim();

    if (!Number.isInteger(frotaId) || frotaId <= 0 || !Number.isInteger(checklistId) || checklistId <= 0) {
      redirect(`/portaria?erro=${encodeURIComponent("IDs inválidos.")}`);
    }
    if (!motivo) redirect(`/portaria?erro=${encodeURIComponent("Informe o que precisa ser corrigido.")}`);

    const rows = await listPortariaToday();
    const row = rows.find((r) => r.frota_id === frotaId && r.checklist_id === checklistId);
    if (!row || !row.motorista_id) {
      redirect(`/portaria?erro=${encodeURIComponent("Frota não encontrada.")}`);
    }
    if (!["BLOQUEADA_CHECKLIST", "CHECKLIST_REALIZADO"].includes(row.status_portaria)) {
      redirect(`/portaria?erro=${encodeURIComponent("O checklist não está em um estado que permita solicitar correção.")}`);
    }

    await registrarMovimentacaoFrota({
      frota_id: frotaId,
      checklist_id: checklistId,
      motorista_id: row!.motorista_id!,
      tipo_movimentacao: "SAIDA",
      usuario_portaria_id: user.email,
      observacao: motivo,
      tipo_acao: "SOLICITACAO_CORRECAO",
      motivo_bloqueio: motivo,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const msg = publicActionError(error, "Erro ao solicitar correção.");
    redirect(`/portaria?erro=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/portaria");
}

export async function liberarSaidaForcadaAction(formData: FormData) {
  try {
    const user = await requireAppUser();
    if (!canApprovePortariaExit(user.perfil)) {
      redirect(`/portaria?erro=${encodeURIComponent("O cargo Portaria não pode aprovar uma saída bloqueada.")}`);
    }
    const frotaId = Number(formData.get("frota_id"));
    const checklistId = Number(formData.get("checklist_id"));
    const justificativa = String(formData.get("observacao") ?? "").trim();

    if (!Number.isInteger(frotaId) || frotaId <= 0 || !Number.isInteger(checklistId) || checklistId <= 0) {
      redirect(`/portaria?erro=${encodeURIComponent("IDs inválidos.")}`);
    }
    if (justificativa.length < 10) {
      redirect(`/portaria?erro=${encodeURIComponent("A justificativa deve ter pelo menos 10 caracteres.")}`);
    }

    const rows = await listPortariaToday();
    const row = rows.find((item) => item.frota_id === frotaId && item.checklist_id === checklistId);
    if (!row?.motorista_id) {
      redirect(`/portaria?erro=${encodeURIComponent("Checklist válido de hoje não encontrado para esta frota.")}`);
    }
    if (row.status_portaria !== "BLOQUEADA_CHECKLIST") {
      redirect(`/portaria?erro=${encodeURIComponent("A liberação forçada só é permitida para bloqueio de checklist.")}`);
    }

    await registrarMovimentacaoFrota({
      frota_id: frotaId,
      checklist_id: checklistId,
      motorista_id: row.motorista_id,
      tipo_movimentacao: "SAIDA",
      usuario_portaria_id: user.email,
      observacao: justificativa,
      tipo_acao: "LIBERACAO_FORCADA",
      motivo_bloqueio: justificativa,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const msg = publicActionError(error, "Erro ao registrar liberação forçada.");
    redirect(`/portaria?erro=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/portaria");
}
