import { NextRequest, NextResponse } from "next/server";
import {
  claimDueEmailSchedules,
  completeEmailSchedule,
  releaseEmailScheduleClaim,
} from "@/lib/repos/email-schedule";
import { sendOperationalScheduleReports } from "@/lib/services/operational-report-schedule";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { reportCalendarDate, reportDayUtcRange, previousBusinessDay } from "@/lib/report-date";
import { apiError } from "@/lib/api-error";

export async function GET() {
  const response = apiError("Use POST para executar o envio.", 405, "METHOD_NOT_ALLOWED");
  response.headers.set("Allow", "POST");
  return response;
}

export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) return apiError("Unauthorized", 401, "INVALID_INTERNAL_TOKEN");

  const ontem = previousBusinessDay(reportCalendarDate());
  const dataRef = new Date(reportDayUtcRange(ontem).start);
  const schedules = await claimDueEmailSchedules({ limit: 25, tipo: "RELATORIO_OPERACIONAL_DIARIO" });

  if (schedules.length === 0) {
    return NextResponse.json({
      aviso: "Nenhuma agenda ativa do tipo RELATORIO_OPERACIONAL_DIARIO. Cadastre em /administracao/emails.",
      data: ontem,
    });
  }

  const resultados = await Promise.all(
    schedules.map(async (schedule) => {
      try {
        const envios = await sendOperationalScheduleReports({ schedule, calendarDate: ontem, dataRef });
        const enviado = envios.length > 0 && envios.every((result) => result.enviado);
        if (enviado) await completeEmailSchedule(schedule, new Date());
        else await releaseEmailScheduleClaim(schedule);
        return { schedule: schedule.nome, enviado, envios };
      } catch (error) {
        await releaseEmailScheduleClaim(schedule);
        return {
          schedule: schedule.nome,
          enviado: false,
          envios: [],
          erro: error instanceof Error ? error.message : "Falha inesperada no envio.",
        };
      }
    })
  );

  const algumaFalha = resultados.some((result) => !result.enviado);
  return NextResponse.json({ data: ontem, resultados }, { status: algumaFalha ? 502 : 200 });
}
