import { AlertTriangle, Gauge, Timer, Truck, Wrench, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Kpis } from "@/lib/repos/frotas";
import { formatNumber } from "@/lib/utils";

export function KpiCards({ kpis }: { kpis: Kpis }) {
  const items = [
    { label: "Total ativas", value: formatNumber(kpis.total_ativos), icon: Truck },
    { label: "Em manutencao", value: formatNumber(kpis.total_manutencao), icon: Wrench },
    { label: "Atencao", value: formatNumber(kpis.total_atencao), icon: AlertTriangle },
    { label: "Critico", value: formatNumber(kpis.total_critico), icon: XCircle },
    {
      label: "Idade media",
      value: kpis.idade_media != null ? `${kpis.idade_media.toFixed(1)} anos` : "—",
      icon: Timer,
    },
    {
      label: "Km medio",
      value: kpis.km_medio != null ? formatNumber(Math.round(kpis.km_medio)) : "—",
      icon: Gauge,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {items.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
