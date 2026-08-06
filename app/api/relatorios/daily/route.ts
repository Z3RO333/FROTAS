// app/api/relatorios/daily/route.ts
import { NextRequest, NextResponse } from "next/server";
import { buildRelatorioDiarioIaEmail } from "@/lib/services/scheduled-report-senders";
import { sendRelatorioDiarioIa } from "@/lib/email";
import {
  claimDueEmailSchedules,
  completeEmailSchedule,
  releaseEmailScheduleClaim,
} from "@/lib/repos/email-schedule";

import { isInternalAuthorized } from "@/lib/internal-auth";
import { reportCalendarDate } from "@/lib/report-date";
import { apiError } from "@/lib/api-error";

export async function GET() {
  const response = apiError("Use POST para executar o envio.", 405, "METHOD_NOT_ALLOWED");
  response.headers.set("Allow", "POST");
  return response;
}

export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) return apiError("Unauthorized", 401, "INVALID_INTERNAL_TOKEN");

  const hoje = reportCalendarDate();

  const { html, alertas, criticos, kpis } = await buildRelatorioDiarioIaEmail(hoje);

  const schedules = await claimDueEmailSchedules({ limit: 25, tipo: "RELATORIO_DIARIO_IA" });

  const destinatarios = Array.from(
    new Set(
      schedules
        .flatMap((s) => s.destinatarios ?? [])
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (destinatarios.length === 0) {
    await Promise.all(schedules.map((schedule) => releaseEmailScheduleClaim(schedule)));
    return NextResponse.json({
      aviso: "Nenhuma agenda ativa do tipo RELATORIO_DIARIO_IA. Cadastre em /administracao/emails.",
      html_preview: html.slice(0, 500),
    });
  }

  const assunto = `[Frotas] Relatório IA — ${hoje}`;
  const sendResult = await sendRelatorioDiarioIa({ destinatarios, html, assunto });

  if (sendResult.ok) {
    await Promise.all(schedules.map((schedule) => completeEmailSchedule(schedule, new Date())));
  } else {
    await Promise.all(schedules.map((schedule) => releaseEmailScheduleClaim(schedule)));
  }

  return NextResponse.json({
    data: hoje,
    kpis,
    total_criticos: criticos.length,
    alertas_abertos: alertas.length,
    destinatarios,
    enviado: sendResult.ok,
    erro_envio: sendResult.ok ? null : sendResult.error,
    html_preview: html.slice(0, 500),
  }, { status: sendResult.ok ? 200 : 502 });
}
