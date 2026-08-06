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
import { sendRelatorioDiarioIa, sendRelatorioOperacionalDiario } from "@/lib/email";
import {
  getChecklistsRealizadosNoDia,
  getFrotasComSemChecklistNoDia,
  getPendenciasCriadasNoDiaPorFrota,
} from "@/lib/repos/relatorios";
import { listCDsDisponibilidade } from "@/lib/repos/disponibilidade";
import { logEmail } from "@/lib/repos/email-logs";
import { getEmailFrom } from "@/lib/email-from";
import { reportCalendarDate, reportDayUtcRange, shiftCalendarDate } from "@/lib/report-date";

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

export async function updateScheduleAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");

  const id = Number(formData.get("id"));

  try {
    const current = await getEmailSchedule(id);
    if (!current) throw new Error("Programação não encontrada.");

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
    await updateEmailSchedule(id, { ...parsed, ativo: current.ativo });
    revalidatePath("/administracao/emails");
    redirect("/administracao/emails?sucesso=Programação+atualizada");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      `/administracao/emails?erro=${encodeURIComponent(
        publicActionError(error, "Erro ao atualizar programação")
      )}`
    );
  }
}

export async function triggerScheduleNowAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");

  const id = Number(formData.get("id"));

  try {
    const schedule = await getEmailSchedule(id);
    if (!schedule) throw new Error("Programação não encontrada.");

    const agora = new Date();
    const fromEmail = getEmailFrom();

    if (schedule.tipo === "RELATORIO_DIARIO_IA") {
      const hoje = reportCalendarDate();
      const { html } = await buildRelatorioDiarioIaEmail(hoje);
      const assunto = `[Frotas] Relatório IA — ${hoje}`;
      const result = await sendRelatorioDiarioIa({
        destinatarios: schedule.destinatarios,
        html,
        assunto,
        enviadoPor: user.email,
      });
      if (!result.ok) throw new Error(result.error);
    } else if (schedule.tipo === "RELATORIO_OPERACIONAL_DIARIO") {
      const ontem = shiftCalendarDate(reportCalendarDate(), -1);
      const dataRef = new Date(reportDayUtcRange(ontem).start);
      const [totalChecklists, frotasChecklist, pendenciasPorFrota] = await Promise.all([
        getChecklistsRealizadosNoDia(ontem),
        getFrotasComSemChecklistNoDia(ontem),
        getPendenciasCriadasNoDiaPorFrota(ontem),
      ]);
      const totalApontamentos = pendenciasPorFrota.reduce((sum, grupo) => sum + grupo.itens.length, 0);
      const result = await sendRelatorioOperacionalDiario({
        destinatarios: schedule.destinatarios,
        dataRef,
        enviadoPor: user.email,
        input: {
          totalChecklists,
          totalApontamentos,
          frotasFizeram: frotasChecklist.fizeram,
          frotasNaoFizeram: frotasChecklist.naoFizeram,
          pendenciasPorFrota,
        },
      });
      if (!result.ok) throw new Error(result.error);
    } else if (schedule.tipo === "DISPONIBILIDADE") {
      const sgMail = await getSgMail();
      const cdsAlvo = schedule.cds_incluidos.length > 0 ? schedule.cds_incluidos : await listCDsDisponibilidade();
      const falhas: string[] = [];

      for (const cdNome of cdsAlvo) {
        const { html, resumo } = await buildDisponibilidadeEmail(cdNome, agora);
        const assunto = `[FROTAS] Disponibilidade ${cdNome} - ${agora.toLocaleDateString("pt-BR")}`;
        const destinatariosStr = schedule.destinatarios.join(",");
        try {
          await sgMail.send({ to: schedule.destinatarios, from: fromEmail, subject: assunto, html });
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
      if (falhas.length > 0) throw new Error(`Falha ao enviar para: ${falhas.join(", ")}`);
    } else {
      const sgMail = await getSgMail();
      const { html: corpo, resumo } = await buildOperationalEmail(schedule.tipo, agora);
      const assunto = `[FROTAS] ${schedule.nome} - ${agora.toLocaleDateString("pt-BR")}`;
      const destinatariosStr = schedule.destinatarios.join(",");
      try {
        await sgMail.send({ to: schedule.destinatarios, from: fromEmail, subject: assunto, html: corpo });
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
    redirect(`/administracao/emails?sucesso=${encodeURIComponent(`"${schedule.nome}" disparada agora`)}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      `/administracao/emails?erro=${encodeURIComponent(
        publicActionError(error, "Erro ao disparar programação")
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
