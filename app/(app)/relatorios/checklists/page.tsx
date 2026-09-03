// app/(app)/relatorios/checklists/page.tsx
import { redirect } from "next/navigation";
import { requireAppUser, canAccessAdmin } from "@/lib/rbac";
import { getRelatorioKpis, getRankingFrotas, getRankingMotoristas } from "@/lib/repos/relatorios";
import { listAlertasAbertos } from "@/lib/repos/alertas";
import { listAnalisesDia } from "@/lib/repos/analises-ia";
import { formatReportDate, reportCalendarDate } from "@/lib/report-date";
import { ChecklistIaKpis } from "@/components/relatorios/checklist-ia-kpis";
import { AlertasAtivos } from "@/components/relatorios/alertas-ativos";
import { RankingFrotas } from "@/components/relatorios/ranking-frotas";
import { ChecklistIaTable } from "@/components/relatorios/checklist-ia-table";
import { Bot, CalendarDays, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RelatoriosChecklistPage() {
  const user = await requireAppUser();
  if (!canAccessAdmin(user.perfil)) redirect("/motorista");

  const agora = new Date();
  const hoje = reportCalendarDate(agora);

  const [kpis, alertas, rankingFrotas, rankingMotoristas, analises] = await Promise.all([
    getRelatorioKpis(hoje),
    listAlertasAbertos(200),
    getRankingFrotas(hoje),
    getRankingMotoristas(hoje),
    listAnalisesDia(hoje),
  ]);

  return (
    <div className="space-y-6 pb-8">
      <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800 px-5 py-6 text-white shadow-sm sm:px-7">
        <Sparkles className="absolute -right-6 -top-8 h-36 w-36 text-white/5" aria-hidden="true" />
        <div className="relative flex items-start gap-4">
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 sm:flex">
            <Bot className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Inteligência operacional</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Análise de Checklists — IA</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-blue-100">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Visão consolidada de hoje, {formatReportDate(agora)}
            </p>
          </div>
        </div>
      </div>

      <ChecklistIaKpis kpis={kpis} />

      <AlertasAtivos alertas={alertas} />

      <div className="grid gap-6 xl:grid-cols-2">
        <RankingFrotas frotas={rankingFrotas} />
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b bg-slate-50/70 px-4 py-4">
            <h2 className="font-semibold">Ranking de motoristas (hoje)</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3 text-left">#</th>
                <th className="p-3 text-left">Motorista</th>
                <th className="p-3 text-right">Checklists</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rankingMotoristas.map((m, i) => (
                <tr key={m.motorista_id} className="hover:bg-slate-50">
                  <td className="p-3 text-muted-foreground">{i + 1}</td>
                  <td className="p-3">
                    <div className="font-medium">{m.motorista_nome ?? m.motorista_id}</div>
                    <div className="text-xs text-muted-foreground">{m.motorista_id}</div>
                  </td>
                  <td className="p-3 text-right font-semibold">{m.total_checklists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Histórico do dia</p>
            <h2 className="mt-1 font-semibold text-slate-900">Análises processadas ({analises.length})</h2>
          </div>
        </div>
        <ChecklistIaTable analises={analises} />
      </section>
    </div>
  );
}
