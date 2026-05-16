"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppUser, canManageUsers } from "@/lib/rbac";
import {
  createEmailSchedule,
  toggleEmailSchedule,
  deleteEmailSchedule,
} from "@/lib/repos/email-schedule";

const ScheduleSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
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
    .transform((s) => s.split(",").map((e) => e.trim()).filter(Boolean)),
  frequencia: z.enum(["DIARIO", "SEMANAL", "QUINZENAL", "MENSAL"]),
  hora_envio: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  cds_incluidos: z
    .string()
    .transform((s) => s.split(",").map((e) => e.trim()).filter(Boolean)),
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
  if (!canManageUsers(user.perfil)) redirect("/");

  try {
    const raw = {
      nome: formData.get("nome"),
      tipo: formData.get("tipo"),
      destinatarios: formData.get("destinatarios"),
      frequencia: formData.get("frequencia"),
      hora_envio: formData.get("hora_envio"),
      cds_incluidos: formData.get("cds_incluidos") ?? "",
    };
    const parsed = ScheduleSchema.parse(raw);
    await createEmailSchedule({
      ...parsed,
      ativo: true,
      criado_por: user.email,
      dia_semana: null,
    });
    revalidatePath("/administracao/emails");
    redirect("/administracao/emails?sucesso=Programação+criada");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      `/administracao/emails?erro=${encodeURIComponent(
        error instanceof Error ? error.message : "Erro ao criar programação"
      )}`
    );
  }
}

export async function toggleScheduleAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canManageUsers(user.perfil)) redirect("/");

  const id = Number(formData.get("id"));
  const ativo = formData.get("ativo") === "true";
  await toggleEmailSchedule(id, !ativo);
  revalidatePath("/administracao/emails");
}

export async function deleteScheduleAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canManageUsers(user.perfil)) redirect("/");

  const id = Number(formData.get("id"));
  await deleteEmailSchedule(id);
  revalidatePath("/administracao/emails");
}
