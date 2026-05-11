import { Mail } from "lucide-react";
import { CockpitSummary } from "@/components/dashboard/cockpit-summary";
import { FrotasPorAnoChart } from "@/components/dashboard/frotas-por-ano-chart";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { StatusDonut } from "@/components/dashboard/status-donut";
import { EnviarRelatorioDialog } from "@/components/relatorios/enviar-relatorio-dialog";
import { Button } from "@/components/ui/button";
import { dashboardFrotasCached } from "@/lib/repos/frotas-cache";
import { enviarRelatorioGeralAction } from "./frotas/_actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { k, operational, conditions, byYear } = await dashboardFrotasCached();

  const reportDialog = (
    <EnviarRelatorioDialog
      title="Enviar relatório geral"
      action={enviarRelatorioGeralAction}
      trigger={
        <Button>
          <Mail className="h-4 w-4" aria-hidden="true" />
          Enviar relatório
        </Button>
      }
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Cockpit de Frotas</p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Operação de Frotas Bemol</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral para localizar problemas, priorizar cadastros e acionar relatórios.
          </p>
        </div>
      </div>

      <KpiCards kpis={k} />
      <CockpitSummary kpis={k} reportDialog={reportDialog} />

      <div className="grid gap-4 xl:grid-cols-2">
        <StatusDonut title="Status operacional" data={operational} />
        <StatusDonut title="Condição da frota" data={conditions} />
      </div>

      <FrotasPorAnoChart data={byYear} />
    </div>
  );
}
