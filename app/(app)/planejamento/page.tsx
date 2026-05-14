import { getPlanejamentoOverview } from "@/lib/repos/planejamento";

export const dynamic = "force-dynamic";

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`rounded-md border p-4 ${color}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-1 text-xs font-medium">{label}</div>
    </div>
  );
}

export default async function PlanejamentoPage() {
  const kpis = await getPlanejamentoOverview();

  const dispPct = kpis.disp_hoje != null ? `${(kpis.disp_hoje * 100).toFixed(1)}%` : "—";
  const metaPct = kpis.disp_meta != null ? `${(kpis.disp_meta * 100).toFixed(0)}%` : "—";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Docs vencidos" value={kpis.docs_vencidos} color="bg-red-50 border-red-200 text-red-800" />
        <Kpi label="Manutenções atrasadas" value={kpis.manut_atrasadas} color="bg-amber-50 border-amber-200 text-amber-800" />
        <Kpi label="Lavagem atrasada" value={kpis.lavagem_atrasada} color="bg-amber-50 border-amber-200 text-amber-800" />
        <Kpi label="Sem kit completo" value={kpis.sem_kit_completo} color="bg-orange-50 border-orange-200 text-orange-800" />
        <Kpi label="Sem estepe" value={kpis.sem_estepe} color="bg-red-50 border-red-200 text-red-800" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Manutenções OK" value={kpis.manut_ok} color="bg-emerald-50 border-emerald-200 text-emerald-800" />
        <Kpi label="Total pneus mapeados" value={kpis.pneus_total} color="bg-blue-50 border-blue-200 text-blue-800" />
        <Kpi label="Disponibilidade (último dia)" value={dispPct} color="bg-blue-50 border-blue-200 text-blue-800" />
        <Kpi label="Meta disponibilidade" value={metaPct} color="bg-slate-50 border-slate-200 text-slate-700" />
      </div>

      <div className="rounded-md border bg-blue-50 p-4 text-sm text-blue-800">
        Use as abas acima para navegar pelos módulos detalhados de manutenção, documentos, pneus, lavagem e disponibilidade.
      </div>
    </div>
  );
}
