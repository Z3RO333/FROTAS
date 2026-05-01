import { KpiCards } from "@/components/dashboard/kpi-cards";
import { StatusDonut } from "@/components/dashboard/status-donut";
import { kpis, statusBreakdown } from "@/lib/repos/frotas";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [k, breakdown] = await Promise.all([kpis(), statusBreakdown()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Disponibilidade de Frotas</h1>
        <p className="text-sm text-muted-foreground">Visao analitica da frota Bemol.</p>
      </div>
      <KpiCards kpis={k} />
      <div className="grid gap-6 xl:grid-cols-2">
        <StatusDonut data={breakdown} />
      </div>
    </div>
  );
}
