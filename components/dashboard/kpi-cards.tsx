import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardX,
  Gauge,
  Timer,
  Truck,
  Wrench,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Kpis } from "@/lib/repos/frotas";
import { formatNumber } from "@/lib/utils";

export function KpiCards({ kpis }: { kpis: Kpis }) {
  const items = [
    { label: "Total de frotas", value: formatNumber(kpis.total_ativos), icon: Truck, href: "/frotas" },
    {
      label: "Disponiveis",
      value: formatNumber(kpis.total_disponiveis),
      icon: CheckCircle2,
      href: "/frotas?operacional=disponivel",
      tone: "text-emerald-700",
    },
    {
      label: "Indisponiveis",
      value: formatNumber(kpis.total_indisponiveis),
      icon: XCircle,
      href: "/frotas?operacional=indisponivel",
      tone: "text-red-700",
    },
    {
      label: "Em manutencao",
      value: formatNumber(kpis.total_manutencao),
      icon: Wrench,
      href: "/frotas?operacional=manutencao",
      tone: "text-amber-700",
    },
    {
      label: "Em atencao",
      value: formatNumber(kpis.total_atencao),
      icon: AlertTriangle,
      href: "/frotas?condicao=atencao",
      tone: "text-orange-700",
    },
    {
      label: "Sem KM",
      value: formatNumber(kpis.total_sem_km),
      icon: Gauge,
      href: "/frotas?semKm=1",
      tone: "text-sky-700",
    },
    {
      label: "Idade media",
      value: kpis.idade_media != null ? `${kpis.idade_media.toFixed(1)} anos` : "-",
      icon: Timer,
      href: "/frotas?idadeMin=7",
    },
    {
      label: "Cadastro incompleto",
      value: formatNumber(kpis.total_cadastro_incompleto),
      icon: ClipboardX,
      href: "/frotas?cadastro=incompleto",
      tone: "text-slate-700",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {items.map(({ label, value, icon: Icon, href, tone }) => (
        <Link key={label} href={href} className="group rounded-lg focus:outline-none focus:ring-2 focus:ring-ring">
          <Card className="h-full border-slate-200 bg-white transition-colors group-hover:border-blue-300 group-hover:bg-blue-50/40">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${tone ?? "text-blue-700"}`} aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{value}</div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
