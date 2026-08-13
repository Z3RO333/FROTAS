"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppUser, canManageEmailSchedules } from "@/lib/rbac";
import {
  createEmailSchedule,
  getEmailSchedule,
  updateEmailSchedule,
  toggleEmailSchedule,
  deleteEmailSchedule,
} from "@/lib/repos/email-schedule";
import { publicActionError } from "@/lib/public-error";
import {
  getSgMail,
  buildDisponibilidadeEmail,
  buildOperationalEmail,
  buildRelatorioDiarioIaEmail,
} from "@/lib/services/scheduled-report-senders";
import { sendRelatorioDiarioIa } from "@/lib/email";
import { sendOperationalScheduleReports } from "@/lib/services/operational-report-schedule";
import { listCDsDisponibilidade } from "@/lib/repos/disponibilidade";
import { updateDestinatarios, type NotificacaoEvento } from "@/lib/repos/notificacao-destinatarios";
import { logEmail } from "@/lib/repos/email-logs";
import { getEmailFrom } from "@/lib/email-from";
import { reportCalendarDate, reportDayUtcRange, previousBusinessDay } from "@/lib/report-date";

const CorporateEmailListSchema = z
  .array(z.string().email("Destinatário inválido."))
  .max(20, "Informe no máximo 20 destinatários por envio.")
  .refine(
    (emails) => emails.every((email) => email.endsWith(`@${(process.env.ALLOWED_EMAIL_DOMAIN ?? "bemol.com.br").toLowerCase()}`)),
    "Use apenas destinatários do domínio corporativo."
  );
const RequiredCorporateEmailListSchema = CorporateEmailListSchema.refine(
  (emails) => emails.length > 0,
  "Informe pelo menos um destinatário para o setor."
);

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
    "RELATORIO_OPERACIONAL_DIARIO",
  ]),
  destinatarios: z
    .string()
    .transform((s) => [...new Set(s.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean))])
    .pipe(CorporateEmailListSchema),
  frequencia: z.enum(["DIARIO", "SEMANAL", "QUINZENAL", "MENSAL"]),
  dia_semana: z.coerce.number().int().min(0).max(6).nullable(),
  dia_mes: z.coerce.number().int().min(1).max(31).nullable(),
  hora_envio: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  cds_incluidos: z
    .string()
    .transform((s) => [...new Set(s.split(",").map((e) => e.trim()).filter(Boolean))])
    .pipe(z.array(z.string().max(120)).max(100)),
  setores_incluidos: z.array(z.string().max(120)).max(100),
  destinatarios_por_setor: z.record(z.string().max(120), RequiredCorporateEmailListSchema),
}).superRefine((schedule, context) => {
  if (schedule.tipo === "RELATORIO_OPERACIONAL_DIARIO" && schedule.setores_incluidos.length > 0) {
    for (const setor of schedule.setores_incluidos) {
      if (!schedule.destinatarios_por_setor[setor]?.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destinatarios_por_setor", setor],
          message: `Informe o destinatário do setor ${setor}.`,
        });
      }
    }
  } else if (schedule.destinatarios.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["destinatarios"],
      message: "Informe pelo menos um destinatário geral.",
    });
  }
});

function scheduleFormRaw(formData: FormData) {
  const setores = formData.getAll("setores_incluidos").map(String);
  const nomes = formData.getAll("setor_nome").map(String);
  const destinatarios = formData.getAll("setor_destinatarios").map(String);
  const destinatariosPorSetor = Object.fromEntries(nomes.map((setor, index) => [
    setor,
    [...new Set((destinatarios[index] ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean))],
  ]));

  return {
    nome: formData.get("nome"),
    tipo: formData.get("tipo"),
    destinatarios: formData.get("destinatarios") ?? "",
    frequencia: formData.get("frequencia"),
    dia_semana: formData.get("dia_semana") || null,
    dia_mes: formData.get("dia_mes") || null,
    hora_envio: formData.get("hora_envio"),
    cds_incluidos: formData.get("cds_incluidos") ?? "",
    setores_incluidos: setores,
    destinatarios_por_setor: destinatariosPorSetor,
  };
}

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
    const raw = scheduleFormRaw(formData);
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

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function updateScheduleAction(formData: FormData): Promise<ActionResult> {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");

  const id = Number(formData.get("id"));

  try {
    const current = await getEmailSchedule(id);
    if (!current) throw new Error("Programação não encontrada.");

    const raw = scheduleFormRaw(formData);
    const parsed = ScheduleSchema.parse(raw);
    await updateEmailSchedule(id, { ...parsed, ativo: current.ativo });
    revalidatePath("/administracao/emails");
    return { ok: true, message: "Programação atualizada" };
  } catch (error) {
    return { ok: false, error: publicActionError(error, "Erro ao atualizar programação") };
  }
}

export async function triggerScheduleNowAction(id: number): Promise<ActionResult> {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");

  try {
    const schedule = await getEmailSchedule(id);
    if (!schedule) throw new Error("Programação não encontrada.");

    const destinatarios = Array.from(
      new Set(schedule.destinatarios.map((e) => e.trim().toLowerCase()).filter(Boolean))
    );

    if (schedule.tipo !== "RELATORIO_OPERACIONAL_DIARIO" && destinatarios.length === 0) {
      return { ok: false, error: "Programação sem destinatários válidos." };
    }

    const agora = new Date();
    const fromEmail = getEmailFrom();

    if (schedule.tipo === "RELATORIO_DIARIO_IA") {
      const hoje = reportCalendarDate();
      const { html } = await buildRelatorioDiarioIaEmail(hoje);
      const assunto = `[Frotas] Relatório IA — ${hoje}`;
      const result = await sendRelatorioDiarioIa({
        destinatarios,
        html,
        assunto,
        enviadoPor: user.email,
        scheduleId: schedule.id,
      });
      if (!result.ok) throw new Error(result.error);
    } else if (schedule.tipo === "RELATORIO_OPERACIONAL_DIARIO") {
      const ontem = previousBusinessDay(reportCalendarDate());
      const dataRef = new Date(reportDayUtcRange(ontem).start);
      const results = await sendOperationalScheduleReports({
        schedule,
        calendarDate: ontem,
        dataRef,
        enviadoPor: user.email,
      });
      const failures = results.filter((result) => !result.enviado);
      if (failures.length > 0) {
        throw new Error(failures.map((failure) => failure.erro).filter(Boolean).join("; "));
      }
    } else if (schedule.tipo === "DISPONIBILIDADE") {
      const sgMail = await getSgMail();
      const cdsAlvo = schedule.cds_incluidos.length > 0 ? schedule.cds_incluidos : await listCDsDisponibilidade();
      const enviados: string[] = [];
      const falhas: string[] = [];

      for (const cdNome of cdsAlvo) {
        const { html, resumo } = await buildDisponibilidadeEmail(cdNome, agora);
        const assunto = `[FROTAS] Disponibilidade ${cdNome} - ${agora.toLocaleDateString("pt-BR")}`;
        const destinatariosStr = destinatarios.join(",");
        try {
          await sgMail.send({ to: destinatarios, from: fromEmail, subject: assunto, html });
          await logEmail({
            tipo: "disponibilidade_cd",
            cdNome,
            destinatarios: destinatariosStr,
            assunto,
            enviadoPor: user.email,
            status: "enviado",
            resumo,
            conteudoHtml: html,
            scheduleId: schedule.id,
          });
          enviados.push(cdNome);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await logEmail({
            tipo: "disponibilidade_cd",
            cdNome,
            destinatarios: destinatariosStr,
            assunto,
            enviadoPor: user.email,
            status: "erro",
            erroMsg: message,
            resumo,
            conteudoHtml: html,
            scheduleId: schedule.id,
          });
          falhas.push(cdNome);
        }
      }
      if (falhas.length > 0 && enviados.length === 0) {
        throw new Error(`Falha ao enviar para: ${falhas.join(", ")}`);
      }
      if (falhas.length > 0 && enviados.length > 0) {
        revalidatePath("/administracao/emails");
        return {
          ok: false,
          error: `"${schedule.nome}" disparada parcialmente — sucesso: ${enviados.join(", ")}; falha: ${falhas.join(", ")}`,
        };
      }
    } else {
      const sgMail = await getSgMail();
      const { html: corpo, resumo } = await buildOperationalEmail(schedule.tipo, agora);
      const assunto = `[FROTAS] ${schedule.nome} - ${agora.toLocaleDateString("pt-BR")}`;
      const destinatariosStr = destinatarios.join(",");
      try {
        await sgMail.send({ to: destinatarios, from: fromEmail, subject: assunto, html: corpo });
        await logEmail({
          tipo: schedule.tipo.toLowerCase(),
          destinatarios: destinatariosStr,
          assunto,
          enviadoPor: user.email,
          status: "enviado",
          resumo,
          conteudoHtml: corpo,
          scheduleId: schedule.id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await logEmail({
          tipo: schedule.tipo.toLowerCase(),
          destinatarios: destinatariosStr,
          assunto,
          enviadoPor: user.email,
          status: "erro",
          erroMsg: message,
          resumo,
          conteudoHtml: corpo,
          scheduleId: schedule.id,
        });
        throw err;
      }
    }

    revalidatePath("/administracao/emails");
    return { ok: true, message: `"${schedule.nome}" disparada agora` };
  } catch (error) {
    return { ok: false, error: publicActionError(error, "Erro ao disparar programação") };
  }
}

export async function toggleScheduleAction(id: number, ativoAtual: boolean): Promise<ActionResult> {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");

  try {
    await toggleEmailSchedule(id, !ativoAtual);
    revalidatePath("/administracao/emails");
    return { ok: true, message: ativoAtual ? "Programação pausada" : "Programação ativada" };
  } catch (error) {
    return { ok: false, error: publicActionError(error, "Erro ao alterar status da programação") };
  }
}

export async function deleteScheduleAction(id: number): Promise<ActionResult> {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");

  try {
    await deleteEmailSchedule(id);
    revalidatePath("/administracao/emails");
    return { ok: true, message: "Programação removida" };
  } catch (error) {
    return { ok: false, error: publicActionError(error, "Erro ao remover programação") };
  }
}

export async function updateNotificacaoDestinatariosAction(
  evento: NotificacaoEvento,
  chave: string | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");

  try {
    const raw = formData.get("destinatarios");
    const emails = typeof raw === "string" ? raw.split(",").map((e) => e.trim()).filter(Boolean) : [];
    const schema = chave === null ? RequiredCorporateEmailListSchema : CorporateEmailListSchema;
    const destinatarios = schema.parse(emails);

    await updateDestinatarios(evento, chave, destinatarios, user.email);
    revalidatePath("/administracao/emails");
    return { ok: true, message: "Destinatários atualizados" };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Dados inválidos." };
    return { ok: false, error: publicActionError(error, "Erro ao atualizar destinatários") };
  }
}
