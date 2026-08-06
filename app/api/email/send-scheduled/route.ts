import { NextRequest, NextResponse } from "next/server";
import { logEmail } from "@/lib/repos/email-logs";
import {
  claimDueEmailSchedules,
  completeEmailSchedule,
  releaseEmailScheduleClaim,
} from "@/lib/repos/email-schedule";
import { getEmailFrom } from "@/lib/email-from";
import { listCDsDisponibilidade } from "@/lib/repos/disponibilidade";

import { isInternalAuthorized } from "@/lib/internal-auth";
import { apiError } from "@/lib/api-error";
import { getSgMail, buildDisponibilidadeEmail, buildOperationalEmail } from "@/lib/services/scheduled-report-senders";

export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) {
    return apiError("Nao autorizado.", 401, "INVALID_INTERNAL_TOKEN");
  }

  const schedules = await claimDueEmailSchedules({ limit: 50, excludeTipo: "RELATORIO_DIARIO_IA" });
  const cds = await listCDsDisponibilidade();
  const agora = new Date();
  const enviados: string[] = [];
  const falhas: string[] = [];

  const sgMail = await getSgMail();
  const fromEmail = getEmailFrom();

  for (const schedule of schedules) {
    const failureCountBefore = falhas.length;

    try {
      if (schedule.tipo === "RELATORIO_OPERACIONAL_DIARIO") {
        await releaseEmailScheduleClaim(schedule);
        continue;
      }
      if (schedule.tipo !== "DISPONIBILIDADE") {
        const { html: corpo, resumo } = await buildOperationalEmail(schedule.tipo, agora);
        const assunto = `[FROTAS] ${schedule.nome} - ${agora.toLocaleDateString("pt-BR")}`;

        await sgMail.send({
          to: schedule.destinatarios,
          from: fromEmail,
          subject: assunto,
          html: corpo,
        });
        await logEmail({
          tipo: schedule.tipo.toLowerCase(),
          cdNome: null,
          destinatarios: schedule.destinatarios.join(","),
          assunto,
          enviadoPor: "sistema",
          status: "enviado",
          resumo,
          conteudoHtml: corpo,
          scheduleId: schedule.id,
        });
        enviados.push(schedule.nome);
        await completeEmailSchedule(schedule, agora);
        continue;
      }

      const cdsAlvo = schedule.cds_incluidos.length > 0 ? schedule.cds_incluidos : cds;
      for (const cdNome of cdsAlvo) {
        const { html, resumo } = await buildDisponibilidadeEmail(cdNome, agora);
        const assunto = `[FROTAS] Disponibilidade ${cdNome} - ${agora.toLocaleDateString("pt-BR")}`;
        const destinatarios = schedule.destinatarios.join(",");

        try {
          await sgMail.send({
            to: schedule.destinatarios,
            from: fromEmail,
            subject: assunto,
            html,
          });

          await logEmail({
            tipo: "disponibilidade_cd",
            cdNome,
            destinatarios,
            assunto,
            enviadoPor: "sistema",
            status: "enviado",
            resumo,
            conteudoHtml: html,
            scheduleId: schedule.id,
          });
          enviados.push(`${schedule.nome} (${cdNome})`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await logEmail({
            tipo: "disponibilidade_cd",
            cdNome,
            destinatarios,
            assunto,
            enviadoPor: "sistema",
            status: "erro",
            erroMsg: message,
            resumo,
            conteudoHtml: html,
            scheduleId: schedule.id,
          });
          falhas.push(`${schedule.nome} (${cdNome})`);
        }
      }

      if (falhas.length === failureCountBefore) await completeEmailSchedule(schedule, agora);
      else await releaseEmailScheduleClaim(schedule);
    } catch (err) {
      console.warn(`[email-schedule] falha ao processar "${schedule.nome}"`, err);
      falhas.push(schedule.nome);
      await releaseEmailScheduleClaim(schedule).catch((releaseError) => {
        console.error("[email-schedule] falha ao liberar claim", releaseError);
      });
    }
  }

  return NextResponse.json(
    { enviados, falhas, total: enviados.length },
    { status: falhas.length > 0 ? 500 : 200 }
  );
}
