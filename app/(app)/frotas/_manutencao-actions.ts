"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminUser } from "@/lib/rbac";
import {
  enviarFrotaParaManutencao,
  retornarFrotaParaOperacao,
  type DestinoManutencao,
} from "@/lib/services/veiculo-status";

const TipoManutencaoSchema = z.enum(["PREVENTIVA", "CORRETIVA", "EMERGENCIAL", "OUTRA"]);

const DestinoManutencaoSchema = z
  .enum(["OFICINA", "LAVAGEM", "PREVENTIVA", "CORRETIVA", "ALINHAMENTO", "AR_CONDICIONADO", "TACOGRAFO", "OUTRO"])
  .optional()
  .nullable();

const EnviarSchema = z.object({
  frota_id: z.coerce.number().int().positive(),
  motivo: z.string().trim().min(3, "Informe um motivo de pelo menos 3 caracteres."),
  tipo: TipoManutencaoSchema,
  oficina: z.string().trim().optional().nullable(),
  prev_retorno: z.string().trim().optional().nullable(),
  observacao: z.string().trim().optional().nullable(),
  bloqueia_checklist: z.coerce.boolean().optional(),
  destino: DestinoManutencaoSchema,
  destino_detalhe: z.string().trim().optional().nullable(),
});

const RetornarSchema = z.object({
  frota_id: z.coerce.number().int().positive(),
  observacao: z.string().trim().min(3, "Informe uma observação de pelo menos 3 caracteres."),
  km_atual: z.coerce.number().int().min(0).optional().nullable(),
  forcar_liberacao: z.coerce.boolean().optional(),
  justificativa_forcada: z.string().trim().optional().nullable(),
});

export type ManutencaoActionState =
  | { ok: true; mensagem: string }
  | { ok: false; error: string; bloqueios?: string[] };

export const MANUTENCAO_INITIAL_STATE: ManutencaoActionState = {
  ok: true,
  mensagem: "",
};

function pickAtivo(formData: FormData, name: string): boolean {
  return formData.getAll(name).map(String).includes("true");
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function enviarManutencaoAction(
  _prev: ManutencaoActionState,
  formData: FormData
): Promise<ManutencaoActionState> {
  try {
    const actor = await requireAdminUser();

    const raw = {
      frota_id: formData.get("frota_id"),
      motivo: formData.get("motivo"),
      tipo: formData.get("tipo"),
      oficina: formData.get("oficina"),
      prev_retorno: formData.get("prev_retorno"),
      observacao: formData.get("observacao"),
      bloqueia_checklist: pickAtivo(formData, "bloqueia_checklist"),
      destino: formData.get("destino") || null,
      destino_detalhe: formData.get("destino_detalhe") || null,
    };

    const parsed = EnviarSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    const result = await enviarFrotaParaManutencao({
      frotaId: parsed.data.frota_id,
      motivo: parsed.data.motivo,
      tipo: parsed.data.tipo,
      oficina: parsed.data.oficina ?? null,
      prevRetorno: parsed.data.prev_retorno ?? null,
      observacao: parsed.data.observacao ?? null,
      bloqueiaChecklist: parsed.data.bloqueia_checklist ?? true,
      destino: (parsed.data.destino as DestinoManutencao | null | undefined) ?? null,
      destino_detalhe: parsed.data.destino_detalhe ?? null,
      usuarioEmail: actor.email,
    });

    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath(`/frotas/${parsed.data.frota_id}`);
    revalidatePath("/frotas");
    revalidatePath("/");
    revalidatePath("/planejamento");
    revalidatePath("/portaria");

    redirect("/planejamento/paradas");
    return { ok: true, mensagem: "" }; // never reached — redirect throws
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const msg = error instanceof z.ZodError
      ? error.issues[0]?.message ?? "Dados inválidos."
      : error instanceof Error
        ? error.message
        : "Erro ao enviar frota para manutenção.";
    return { ok: false, error: msg };
  }
}

export async function retornarOperacaoAction(
  _prev: ManutencaoActionState,
  formData: FormData
): Promise<ManutencaoActionState> {
  try {
    const actor = await requireAdminUser();

    const raw = {
      frota_id: formData.get("frota_id"),
      observacao: formData.get("observacao"),
      km_atual: formData.get("km_atual") || undefined,
      forcar_liberacao: pickAtivo(formData, "forcar_liberacao"),
      justificativa_forcada: formData.get("justificativa_forcada"),
    };

    const parsed = RetornarSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    const result = await retornarFrotaParaOperacao({
      frotaId: parsed.data.frota_id,
      observacao: parsed.data.observacao,
      kmAtual: parsed.data.km_atual ?? null,
      forcarLiberacao: parsed.data.forcar_liberacao ?? false,
      justificativaForcada: parsed.data.justificativa_forcada ?? null,
      usuarioEmail: actor.email,
    });

    if (!result.ok) {
      return { ok: false, error: result.error, bloqueios: result.bloqueios };
    }

    revalidatePath(`/frotas/${parsed.data.frota_id}`);
    revalidatePath("/frotas");
    revalidatePath("/");
    revalidatePath("/planejamento");
    revalidatePath("/portaria");

    return { ok: true, mensagem: "Frota retornou à operação." };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const msg = error instanceof z.ZodError
      ? error.issues[0]?.message ?? "Dados inválidos."
      : error instanceof Error
        ? error.message
        : "Erro ao retornar frota à operação.";
    return { ok: false, error: msg };
  }
}
