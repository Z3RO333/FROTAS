import type { EmailSchedule } from "@/lib/repos/email-schedule";
import {
  getChecklistsRealizadosNoDia,
  getFrotasComSemChecklistNoDia,
  getObservacoesCriadasNoDiaPorFrota,
  getPendenciasCriadasNoDiaPorFrota,
} from "@/lib/repos/relatorios";
import { sendRelatorioOperacionalDiario } from "@/lib/email";
import { getOperationalScheduleAudiences } from "@/lib/email-schedule-audiences";

export type OperationalScheduleSendResult = {
  setor: string | null;
  destinatarios: string[];
  totalChecklists: number;
  totalApontamentos: number;
  frotasFizeram: number;
  frotasNaoFizeram: number;
  enviado: boolean;
  erro: string | null;
};

export async function sendOperationalScheduleReports({
  schedule,
  calendarDate,
  dataRef,
  enviadoPor,
}: {
  schedule: EmailSchedule;
  calendarDate: string;
  dataRef: Date;
  enviadoPor?: string;
}): Promise<OperationalScheduleSendResult[]> {
  const audiences = getOperationalScheduleAudiences(schedule);
  const results: OperationalScheduleSendResult[] = [];

  for (const audience of audiences) {
    if (audience.destinatarios.length === 0) {
      results.push({
        setor: audience.setor,
        destinatarios: [],
        totalChecklists: 0,
        totalApontamentos: 0,
        frotasFizeram: 0,
        frotasNaoFizeram: 0,
        enviado: false,
        erro: audience.setor
          ? `Setor ${audience.setor} sem destinatários válidos.`
          : "Agenda sem destinatários gerais válidos.",
      });
      continue;
    }

    const setores = audience.setor ? [audience.setor] : undefined;
    const [totalChecklists, frotasChecklist, pendenciasPorFrota, observacoesPorFrota] = await Promise.all([
      getChecklistsRealizadosNoDia(calendarDate, setores),
      getFrotasComSemChecklistNoDia(calendarDate, setores),
      getPendenciasCriadasNoDiaPorFrota(calendarDate, setores),
      getObservacoesCriadasNoDiaPorFrota(calendarDate, setores),
    ]);
    const totalApontamentos =
      pendenciasPorFrota.reduce((sum, grupo) => sum + grupo.itens.length, 0) +
      observacoesPorFrota.reduce((sum, grupo) => sum + grupo.observacoes.length, 0);

    const sent = await sendRelatorioOperacionalDiario({
      destinatarios: audience.destinatarios,
      dataRef,
      enviadoPor,
      scheduleId: schedule.id,
      anexarResumoPdf: audience.setor === null,
      contextoAssunto: audience.setor ?? undefined,
      input: {
        totalChecklists,
        totalApontamentos,
        frotasFizeram: frotasChecklist.fizeram,
        frotasNaoFizeram: frotasChecklist.naoFizeram,
        pendenciasPorFrota,
        observacoesPorFrota,
      },
    });

    results.push({
      setor: audience.setor,
      destinatarios: audience.destinatarios,
      totalChecklists,
      totalApontamentos,
      frotasFizeram: frotasChecklist.fizeram.length,
      frotasNaoFizeram: frotasChecklist.naoFizeram.length,
      enviado: sent.ok,
      erro: sent.ok ? null : sent.error,
    });
  }

  return results;
}
