// app/api/relatorios/operacional-diario/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getChecklistsRealizadosNoDia,
  getFrotasComSemChecklistNoDia,
  getPendenciasCriadasNoDiaPorFrota,
} from "@/lib/repos/relatorios";
import { sendRelatorioOperacionalDiario } from "@/lib/email";
import {
  claimDueEmailSchedules,
  completeEmailSchedule,
  releaseEmailScheduleClaim,
} from "@/lib/repos/email-schedule";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { reportCalendarDate, reportDayUtcRange, shiftCalendarDate } from "@/lib/report-date";
import { apiError } from "@/lib/api-error";

export async function GET() {
  const response = apiError("Use POST para executar o envio.", 405, "METHOD_NOT_ALLOWED");
  response.headers.set("Allow", "POST");
  return response;
}

export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) return apiError("Unauthorized", 401, "INVALID_INTERNAL_TOKEN");

  const ontem = shiftCalendarDate(reportCalendarDate(), -1);
  const dataRef = new Date(reportDayUtcRange(ontem).start);

  const [totalChecklists, frotasChecklist, pendenciasPorFrota] = await Promise.all([
    getChecklistsRealizadosNoDia(ontem),
    getFrotasComSemChecklistNoDia(ontem),
    getPendenciasCriadasNoDiaPorFrota(ontem),
  ]);

  const totalApontamentos = pendenciasPorFrota.reduce((sum, grupo) => sum + grupo.itens.length, 0);

  const schedules = await claimDueEmailSchedules({ limit: 25, tipo: "RELATORIO_OPERACIONAL_DIARIO" });

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
      aviso: "Nenhuma agenda ativa do tipo RELATORIO_OPERACIONAL_DIARIO. Cadastre em /administracao/emails.",
      data: ontem,
    });
  }

  const sendResult = await sendRelatorioOperacionalDiario({
    destinatarios,
    dataRef,
    input: {
      totalChecklists,
      totalApontamentos,
      frotasFizeram: frotasChecklist.fizeram,
      frotasNaoFizeram: frotasChecklist.naoFizeram,
      pendenciasPorFrota,
    },
  });

  if (sendResult.ok) {
    await Promise.all(schedules.map((schedule) => completeEmailSchedule(schedule, new Date())));
  } else {
    await Promise.all(schedules.map((schedule) => releaseEmailScheduleClaim(schedule)));
  }

  return NextResponse.json(
    {
      data: ontem,
      total_checklists: totalChecklists,
      total_apontamentos: totalApontamentos,
      frotas_fizeram: frotasChecklist.fizeram.length,
      frotas_nao_fizeram: frotasChecklist.naoFizeram.length,
      destinatarios,
      enviado: sendResult.ok,
      erro_envio: sendResult.ok ? null : sendResult.error,
    },
    { status: sendResult.ok ? 200 : 502 }
  );
}
