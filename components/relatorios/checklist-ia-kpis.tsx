import type { RelatorioKpis } from "@/lib/repos/relatorios";
import { AlertTriangle, Bot, CheckCircle2, CircleAlert, ShieldAlert, Wrench } from "lucide-react";

const CRITICIDADE_COLORS = {
  ok: "bg-emerald-50 border-emerald-200 text-emerald-800",
  atencao: "bg-amber-50 border-amber-200 text-amber-800",
  critico: "bg-red-50 border-red-200 text-red-800",
  manutencao: "bg-orange-50 border-orange-200 text-orange-800",
  bloqueio_sugerido: "bg-red-100 border-red-300 text-red-900",
};

export function ChecklistIaKpis({ kpis }: { kpis: RelatorioKpis }) {
  const cards = [
    { label: "Total do dia", value: kpis.total_checklists, color: "bg-blue-50 border-blue-200 text-blue-800", icon: Bot },
    { label: "OK", value: kpis.ok, color: CRITICIDADE_COLORS.ok, icon: CheckCircle2 },
    { label: "Atenção", value: kpis.atencao, color: CRITICIDADE_COLORS.atencao, icon: CircleAlert },
    { label: "Crítico", value: kpis.critico, color: CRITICIDADE_COLORS.critico, icon: AlertTriangle },
    { label: "Manutenção", value: kpis.manutencao, color: CRITICIDADE_COLORS.manutencao, icon: Wrench },
    { label: "Bloqueio sugerido", value: kpis.bloqueio_sugerido, color: CRITICIDADE_COLORS.bloqueio_sugerido, icon: ShieldAlert },
    { label: "Alertas abertos", value: kpis.alertas_abertos, color: "bg-white border-slate-200 text-slate-800", icon: AlertTriangle },
    { label: "Pendentes análise", value: kpis.pendentes_analise, color: "bg-white border-slate-200 text-slate-700", icon: Bot },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8" aria-label="Indicadores das análises de hoje">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl border p-3 shadow-sm ${card.color}`}>
          <div className="mb-3 flex items-center justify-between">
            <card.icon className="h-4 w-4 opacity-75" aria-hidden="true" />
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
          </div>
          <div className="text-2xl font-bold tabular-nums">{card.value}</div>
          <div className="mt-0.5 text-xs font-medium leading-tight">{card.label}</div>
        </div>
      ))}
    </section>
  );
}
