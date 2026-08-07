// app/api/relatorios/operacional-diario/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getChecklistsRealizadosNoDia,
  getFrotasComSemChecklistNoDia,
  getPendenciasCriadasNoDiaPorFrota,
  getObservacoesCriadasNoDiaPorFrota,
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

  const schedules = await claimDueEmailSchedules({ limit: 25, tipo: "RELATORIO_OPERACIONAL_DIARIO" });

  if (schedules.length === 0) {
    return NextResponse.json({
      aviso: "Nenhuma agenda ativa do tipo RELATORIO_OPERACIONAL_DIARIO. Cadastre em /administracao/emails.",
      data: ontem,
    });
  }

  // Cada agenda pode ter seu proprio recorte de setores (setores_incluidos) — o relatorio e
  // montado e enviado individualmente por agenda, nao mais combinado num unico e-mail.
  const resultados = await Promise.all(
    schedules.map(async (schedule) => {
      const destinatarios = Array.from(
        new Set((schedule.destinatarios ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean))
      );

      if (destinatarios.length === 0) {
        await releaseEmailScheduleClaim(schedule);
        return { schedule: schedule.nome, enviado: false, erro: "Agenda sem destinatários válidos." };
      }

      const setores = schedule.setores_incluidos.length > 0 ? schedule.setores_incluidos : undefined;

      const [totalChecklists, frotasChecklist, pendenciasPorFrota, observacoesPorFrota] = await Promise.all([
        getChecklistsRealizadosNoDia(ontem, setores),
        getFrotasComSemChecklistNoDia(ontem, setores),
        getPendenciasCriadasNoDiaPorFrota(ontem, setores),
        getObservacoesCriadasNoDiaPorFrota(ontem, setores),
      ]);

      const totalApontamentos =
        pendenciasPorFrota.reduce((sum, grupo) => sum + grupo.itens.length, 0) +
        observacoesPorFrota.reduce((sum, grupo) => sum + grupo.observacoes.length, 0);

      const sendResult = await sendRelatorioOperacionalDiario({
        destinatarios,
        dataRef,
        scheduleId: schedule.id,
        anexarResumoPdf: !setores,
        input: {
          totalChecklists,
          totalApontamentos,
          frotasFizeram: frotasChecklist.fizeram,
          frotasNaoFizeram: frotasChecklist.naoFizeram,
          pendenciasPorFrota,
          observacoesPorFrota,
        },
      });

      if (sendResult.ok) {
        await completeEmailSchedule(schedule, new Date());
      } else {
        await releaseEmailScheduleClaim(schedule);
      }

      return {
        schedule: schedule.nome,
        setores_incluidos: schedule.setores_incluidos,
        total_checklists: totalChecklists,
        total_apontamentos: totalApontamentos,
        frotas_fizeram: frotasChecklist.fizeram.length,
        frotas_nao_fizeram: frotasChecklist.naoFizeram.length,
        destinatarios,
        enviado: sendResult.ok,
        erro: sendResult.ok ? null : sendResult.error,
      };
    })
  );

  const algumaFalha = resultados.some((r) => !r.enviado);

  return NextResponse.json({ data: ontem, resultados }, { status: algumaFalha ? 502 : 200 });
}
