"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canManageEmailSchedules, requireAppUser } from "@/lib/rbac";
import {
  createEmailSchedule,
  deleteEmailSchedule,
  toggleEmailSchedule,
} from "@/lib/repos/email-schedule";
import { listFrotasForReport } from "@/lib/repos/frotas";
import { sendRelatorioGeral } from "@/lib/email";

const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "bemol.com.br").toLowerCase();
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EmailListSchema = z
  .string()
  .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean))
  .refine((es) => es.length > 0, { message: "Informe pelo menos um destinatário." })
  .refine((es) => es.length <= 10, { message: "Máximo 10 destinatários." })
  .refine((es) => es.every((e) => EMAIL_REGEX.test(e)), { message: "E-mails inválidos." })
  .refine(
    (es) => es.every((e) => e.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)),
    { message: `Apenas @${ALLOWED_EMAIL_DOMAIN}.` }
  );

export async function enviarRelatorioDisponibilidadeCDAction(
  cdNome: string | undefined,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireAppUser();
    const raw = formData.get("destinatarios");
    if (typeof raw !== "string") return { ok: false, error: "Destinatários obrigatórios." };
    const destinatarios = EmailListSchema.parse(raw);
    const frotas = await listFrotasForReport(cdNome ? { cd: cdNome } : {});
    const result = await sendRelatorioGeral({ destinatarios, frotas, enviadoPor: user.email, cdNome });
    return result.ok ? { ok: true } : { ok: false, error: (result as { error?: string }).error ?? "Erro ao enviar." };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Dados inválidos." };
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao enviar relatório." };
  }
}

const PATH = "/frotas/disponibilidades";

const ScheduleSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatorio"),
  cd_nome: z.string().trim().min(1),
  destinatarios: z
    .string()
    .transform((s) => s.split(",").map((e) => e.trim()).filter(Boolean))
    .refine((items) => items.length > 0, "Informe pelo menos um destinatario"),
  frequencia: z.enum(["DIARIO", "SEMANAL", "MENSAL", "PERSONALIZADO"]),
  hora_envio: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
});

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

function targetUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return `${PATH}?${search.toString()}`;
}

async function requireScheduleManager() {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) {
    redirect(targetUrl({ erro: "Voce nao tem permissao para configurar envios programados." }));
  }
  return user;
}

export async function createDisponibilidadeScheduleAction(formData: FormData) {
  const user = await requireScheduleManager();

  try {
    const parsed = ScheduleSchema.parse({
      nome: formData.get("nome"),
      cd_nome: formData.get("cd_nome"),
      destinatarios: formData.get("destinatarios"),
      frequencia: formData.get("frequencia"),
      hora_envio: formData.get("hora_envio"),
    });

    await createEmailSchedule({
      nome: parsed.nome,
      tipo: "DISPONIBILIDADE",
      destinatarios: parsed.destinatarios,
      frequencia: parsed.frequencia,
      hora_envio: parsed.hora_envio,
      cds_incluidos: parsed.cd_nome === "__ALL__" ? [] : [parsed.cd_nome],
      ativo: true,
      criado_por: user.email,
      dia_semana: null,
    });

    revalidatePath(PATH);
    redirect(targetUrl({ sucesso: "Programação criada." }));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      targetUrl({
        erro: error instanceof Error ? error.message : "Erro ao criar programação.",
      })
    );
  }
}

export async function toggleDisponibilidadeScheduleAction(formData: FormData) {
  await requireScheduleManager();

  const id = Number(formData.get("id"));
  const ativo = formData.get("ativo") === "true";
  if (!Number.isInteger(id) || id <= 0) redirect(targetUrl({ erro: "Programação inválida." }));

  await toggleEmailSchedule(id, !ativo);
  revalidatePath(PATH);
}

export async function deleteDisponibilidadeScheduleAction(formData: FormData) {
  await requireScheduleManager();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) redirect(targetUrl({ erro: "Programação inválida." }));

  await deleteEmailSchedule(id);
  revalidatePath(PATH);
}
