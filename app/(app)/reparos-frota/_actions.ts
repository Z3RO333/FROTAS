"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireReparoFrotaUser } from "@/lib/rbac";
import { getFrota } from "@/lib/repos/frotas";
import { createReparoFrota, updateReparoFrotaStatus, type ReparoStatus } from "@/lib/repos/reparos-frota";
import { sendReparoFrotaNotification } from "@/lib/email";
import { publicActionError } from "@/lib/public-error";
import type { ReparoFrotaActionState } from "./types";

const PrioridadeSchema = z.enum(["NORMAL", "URGENTE", "ALTA"]);
const CarregadaSchema = z.enum(["sim", "nao"]);
const StatusSchema = z.enum(["ABERTA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]);

function requiredText(formData: FormData, key: string, message: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value.trim();
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function enviarReparoFrotaAction(
  _prevState: ReparoFrotaActionState,
  formData: FormData
): Promise<ReparoFrotaActionState> {
  try {
    const user = await requireReparoFrotaUser();

    const frotaId = z.coerce.number().int().positive("Selecione a frota.").parse(formData.get("frota_id"));
    const km = z.coerce.number().int().min(0, "Informe o KM da frota.").parse(formData.get("km"));
    const litrosRaw = formData.get("litros");
    const litros =
      typeof litrosRaw === "string" && litrosRaw.trim()
        ? z.coerce.number().min(0, "Litros inválido.").parse(litrosRaw)
        : null;
    const motivoVerificacao = requiredText(formData, "motivo_verificacao", "Descreva o motivo da verificação.");
    const localizacao = requiredText(formData, "localizacao", "Informe onde a frota está.");
    const frotaCarregada = CarregadaSchema.parse(formData.get("frota_carregada")) === "sim";
    const prioridade = PrioridadeSchema.parse(formData.get("prioridade"));

    const frota = await getFrota(frotaId);
    if (!frota) throw new Error("Frota não encontrada.");

    const { ticket_number: ticketNumber } = await createReparoFrota({
      frota_id: frota.id,
      numero_frota: frota.frota_geral ?? null,
      placa: frota.placa ?? null,
      km,
      litros,
      motivo_verificacao: motivoVerificacao,
      localizacao,
      frota_carregada: frotaCarregada,
      prioridade,
      solicitante_id: user.email,
      solicitante_nome: user.name,
    });

    sendReparoFrotaNotification({
      ticketNumber,
      solicitanteNome: user.name,
      solicitanteEmail: user.email,
      numeroFrota: frota.frota_geral ?? null,
      placa: frota.placa ?? null,
      km,
      litros,
      motivoVerificacao,
      localizacao,
      frotaCarregada,
      prioridade,
    }).catch((err) => console.warn("[reparo-frota] falha ao enviar notificacao por e-mail", err));

    revalidatePath("/reparos-frota");
    return { ok: true, redirectTo: `/reparos-frota?ticket=${encodeURIComponent(ticketNumber)}` };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Dados inválidos." };
    }
    return { ok: false, error: publicActionError(error, "Não foi possível enviar a solicitação.") };
  }
}

export async function atualizarStatusReparoFrotaAction(
  _prevState: { ok: boolean; error: string | null },
  formData: FormData
): Promise<{ ok: boolean; error: string | null }> {
  const admin = await requireReparoFrotaUser();

  try {
    const reparoId = z.coerce.number().int().positive().parse(formData.get("reparo_id"));
    const novoStatus = StatusSchema.parse(formData.get("novo_status")) as ReparoStatus;

    await updateReparoFrotaStatus(reparoId, novoStatus, admin.email);
    revalidatePath("/reparos-frota");
    return { ok: true, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Dados invalidos." };
    }
    return { ok: false, error: publicActionError(error, "Nao foi possivel atualizar o status.") };
  }
}
