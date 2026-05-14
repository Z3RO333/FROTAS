// app/(app)/relatorios/checklists/page.tsx
import { redirect } from "next/navigation";
import { requireAppUser, canAccessAdmin } from "@/lib/rbac";
import { getRelatorioKpis, getRankingFrotas, getRankingMotoristas } from "@/lib/repos/relatorios";
import { listAlertasAbertos } from "@/lib/repos/alertas";
import { listAnalisesDia } from "@/lib/repos/analises-ia";
import { ChecklistIaKpis } from "@/components/relatorios/checklist-ia-kpis";
import { AlertasAtivos } from "@/components/relatorios/alertas-ativos";
import { RankingFrotas } from "@/components/relatorios/ranking-frotas";
import { ChecklistIaTable } from "@/components/relatorios/checklist-ia-table";

export const dynamic = "force-dynamic";

export default async function RelatoriosChecklistPage() {
  const user = await requireAppUser();
  if (!canAccessAdmin(user.perfil)) redirect("/motorista");

  const hoje = new Date().toISOString().slice(0, 10);

  const [kpis, alertas, rankingFrotas, rankingMotoristas, analises] = await Promise.all([
    getRelatorioKpis(hoje),
    listAlertasAbertos(20),
    getRankingFrotas(hoje),
    getRankingMotoristas(hoje),
    listAnalisesDia(hoje),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Inteligência Operacional</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Análise de Checklists — IA</h1>
        <p className="text-sm text-muted-foreground">
          Resultados de hoje ({new Date().toLocaleDateString("pt-BR")})
        </p>
      </div>

      <ChecklistIaKpis kpis={kpis} />

      <AlertasAtivos alertas={alertas} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RankingFrotas frotas={rankingFrotas} />
        <div className="overflow-hidden rounded-md border bg-white">
          <div className="border-b px-4 py-3">
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

      <div>
        <div className="mb-3">
          <h2 className="font-semibold text-slate-900">Análises de hoje ({analises.length})</h2>
        </div>
        <ChecklistIaTable analises={analises} />
      </div>
    </div>
  );
}
