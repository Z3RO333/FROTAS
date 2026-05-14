import type { RelatorioKpis } from "@/lib/repos/relatorios";

const CRITICIDADE_COLORS = {
  ok: "bg-emerald-50 border-emerald-200 text-emerald-800",
  atencao: "bg-amber-50 border-amber-200 text-amber-800",
  critico: "bg-red-50 border-red-200 text-red-800",
  manutencao: "bg-orange-50 border-orange-200 text-orange-800",
  bloqueio_sugerido: "bg-red-100 border-red-300 text-red-900",
};

export function ChecklistIaKpis({ kpis }: { kpis: RelatorioKpis }) {
  const cards = [
    { label: "Total do dia", value: kpis.total_checklists, color: "bg-blue-50 border-blue-200 text-blue-800" },
    { label: "OK", value: kpis.ok, color: CRITICIDADE_COLORS.ok },
    { label: "Atenção", value: kpis.atencao, color: CRITICIDADE_COLORS.atencao },
    { label: "Crítico", value: kpis.critico, color: CRITICIDADE_COLORS.critico },
    { label: "Manutenção", value: kpis.manutencao, color: CRITICIDADE_COLORS.manutencao },
    { label: "Bloqueio sugerido", value: kpis.bloqueio_sugerido, color: CRITICIDADE_COLORS.bloqueio_sugerido },
    { label: "Alertas abertos", value: kpis.alertas_abertos, color: "bg-slate-50 border-slate-200 text-slate-800" },
    { label: "Pendentes análise", value: kpis.pendentes_analise, color: "bg-slate-50 border-slate-200 text-slate-700" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-md border p-3 ${card.color}`}>
          <div className="text-2xl font-bold">{card.value}</div>
          <div className="mt-0.5 text-xs font-medium">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
