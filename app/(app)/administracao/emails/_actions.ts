"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppUser, canManageEmailSchedules } from "@/lib/rbac";
import {
  createEmailSchedule,
  toggleEmailSchedule,
  deleteEmailSchedule,
} from "@/lib/repos/email-schedule";
import { publicActionError } from "@/lib/public-error";

const ScheduleSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(120),
  tipo: z.enum([
    "DISPONIBILIDADE",
    "PREVENTIVAS_ATRASO",
    "LAVAGEM_PENDENTE",
    "TACOGRAFO_VENCIDO",
    "FROTAS_PARADAS",
    "CUSTOS",
    "ALERTAS",
    "RELATORIO_DIARIO_IA",
  ]),
  destinatarios: z
    .string()
    .transform((s) => [...new Set(s.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean))])
    .pipe(
      z
        .array(z.string().email("Destinatário inválido."))
        .min(1, "Informe pelo menos um destinatário.")
        .max(20, "Informe no máximo 20 destinatários.")
        .refine(
          (emails) => emails.every((email) => email.endsWith(`@${(process.env.ALLOWED_EMAIL_DOMAIN ?? "bemol.com.br").toLowerCase()}`)),
          "Use apenas destinatários do domínio corporativo."
        )
    ),
  frequencia: z.enum(["DIARIO", "SEMANAL", "QUINZENAL", "MENSAL"]),
  dia_semana: z.coerce.number().int().min(0).max(6).nullable(),
  dia_mes: z.coerce.number().int().min(1).max(31).nullable(),
  hora_envio: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  cds_incluidos: z
    .string()
    .transform((s) => [...new Set(s.split(",").map((e) => e.trim()).filter(Boolean))])
    .pipe(z.array(z.string().max(120)).max(100)),
});

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function createScheduleAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");

  try {
    const raw = {
      nome: formData.get("nome"),
      tipo: formData.get("tipo"),
      destinatarios: formData.get("destinatarios"),
      frequencia: formData.get("frequencia"),
      dia_semana: formData.get("dia_semana") || null,
      dia_mes: formData.get("dia_mes") || null,
      hora_envio: formData.get("hora_envio"),
      cds_incluidos: formData.get("cds_incluidos") ?? "",
    };
    const parsed = ScheduleSchema.parse(raw);
    await createEmailSchedule({
      ...parsed,
      ativo: true,
      criado_por: user.email,
    });
    revalidatePath("/administracao/emails");
    redirect("/administracao/emails?sucesso=Programação+criada");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      `/administracao/emails?erro=${encodeURIComponent(
        publicActionError(error, "Erro ao criar programação")
      )}`
    );
  }
}

export async function toggleScheduleAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");

  const id = Number(formData.get("id"));
  const ativo = formData.get("ativo") === "true";
  await toggleEmailSchedule(id, !ativo);
  revalidatePath("/administracao/emails");
}

export async function deleteScheduleAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");

  const id = Number(formData.get("id"));
  await deleteEmailSchedule(id);
  revalidatePath("/administracao/emails");
}
