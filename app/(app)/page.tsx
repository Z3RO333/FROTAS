import { redirect } from "next/navigation";
import { CockpitSummary } from "@/components/dashboard/cockpit-summary";
import { FrotasPorAnoChart } from "@/components/dashboard/frotas-por-ano-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { StatusDonut } from "@/components/dashboard/status-donut";
import { EnviarRelatorioDialog } from "@/components/relatorios/enviar-relatorio-dialog";
import { dashboardFrotasCached } from "@/lib/repos/frotas-cache";
import { requireAppUser } from "@/lib/rbac";
import { enviarRelatorioGeralAction } from "./frotas/_actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAppUser();
  if (user.perfil === "MOTORISTA") redirect("/motorista");
  if (user.perfil === "PORTARIA") redirect("/portaria");

  const { k, operational, conditions, byYear } = await dashboardFrotasCached();

  const reportDialog = (
    <EnviarRelatorioDialog title="Enviar relatorio geral" action={enviarRelatorioGeralAction} />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Cockpit de Frotas</p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Operacao de Frotas Bemol</h1>
          <p className="text-sm text-muted-foreground">
            Visao geral para localizar problemas, priorizar cadastros e acionar relatorios.
          </p>
        </div>
      </div>

      <KpiCards kpis={k} />
      <CockpitSummary kpis={k} reportDialog={reportDialog} />

      <div className="grid gap-4 xl:grid-cols-2">
        <StatusDonut title="Status operacional" data={operational} />
        <StatusDonut title="Condicao da frota" data={conditions} />
      </div>

      <FrotasPorAnoChart data={byYear} />
    </div>
  );
}
