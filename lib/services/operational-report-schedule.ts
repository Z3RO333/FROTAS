import type { EmailSchedule } from "@/lib/repos/email-schedule";
import {
  getChecklistsRealizadosNoDia,
  getFrotasComSemChecklistNoDia,
  getObservacoesCriadasNoDiaPorFrota,
  getPendenciasCriadasNoDiaPorFrota,
} from "@/lib/repos/relatorios";
import { sendRelatorioOperacionalDiario } from "@/lib/email";
import { getOperationalScheduleAudiences, resumoSetoresAssunto } from "@/lib/email-schedule-audiences";

export type OperationalScheduleSendResult = {
  setores: string[] | null;
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
  // Quando a agenda marca um único CD, o assunto usa o nome do CD em vez da
  // lista de setores — "CD Manaus" é mais claro do que os nomes de setor
  // amontoados (ou resumidos em "e mais N"), mesmo que os setores marcados
  // não representem 100% das frotas daquele CD.
  const cdUnico = schedule.cds_incluidos.length === 1 ? schedule.cds_incluidos[0] : null;

  for (const audience of audiences) {
    if (audience.destinatarios.length === 0) {
      results.push({
        setores: audience.setores,
        destinatarios: [],
        totalChecklists: 0,
        totalApontamentos: 0,
        frotasFizeram: 0,
        frotasNaoFizeram: 0,
        enviado: false,
        erro: audience.setores
          ? `Setor(es) ${audience.setores.join(", ")} sem destinatários válidos.`
          : "Agenda sem destinatários gerais válidos.",
      });
      continue;
    }

    const setores = audience.setores ?? undefined;
    const [totalChecklists, frotasChecklist, pendenciasPorFrota, observacoesPorFrota] = await Promise.all([
      getChecklistsRealizadosNoDia(calendarDate, setores),
      getFrotasComSemChecklistNoDia(calendarDate, setores),
      getPendenciasCriadasNoDiaPorFrota(calendarDate, setores),
      getObservacoesCriadasNoDiaPorFrota(calendarDate, setores),
    ]);

    // Setor configurado que não casa com nenhuma frota gera um relatório todo
    // zerado e indistinguível de um dia sem checklist — foi exatamente o que
    // aconteceu quando os setores da agenda ficaram órfãos após a revisão do
    // cadastro. Falhar aqui deixa o erro de configuração visível.
    const frotasNoEscopo = frotasChecklist.fizeram.length + frotasChecklist.naoFizeram.length;
    if (audience.setores !== null && frotasNoEscopo === 0) {
      results.push({
        setores: audience.setores,
        destinatarios: audience.destinatarios,
        totalChecklists: 0,
        totalApontamentos: 0,
        frotasFizeram: 0,
        frotasNaoFizeram: 0,
        enviado: false,
        erro:
          `Setor(es) ${audience.setores.join(", ")} não correspondem a nenhuma frota ativa. ` +
          "Revise os setores da agenda em /administracao/emails.",
      });
      continue;
    }

    const totalApontamentos =
      pendenciasPorFrota.reduce((sum, grupo) => sum + grupo.itens.length, 0) +
      observacoesPorFrota.reduce((sum, grupo) => sum + grupo.observacoes.length, 0);

    const sent = await sendRelatorioOperacionalDiario({
      destinatarios: audience.destinatarios,
      dataRef,
      enviadoPor,
      scheduleId: schedule.id,
      anexarResumoPdf: audience.setores === null,
      // cds_incluidos não filtra o conteúdo deste relatório (só setores_incluidos
      // filtra) — então só rotula pelo CD quando a agenda de fato tem setores
      // marcados; senão a etiqueta "CD X" mentiria sobre um envio geral.
      contextoAssunto: audience.setores ? (cdUnico ?? resumoSetoresAssunto(audience.setores)) : undefined,
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
      setores: audience.setores,
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
