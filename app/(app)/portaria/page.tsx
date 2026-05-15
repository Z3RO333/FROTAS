import { requireAppUser } from "@/lib/rbac";
import { listPortariaForDate } from "@/lib/repos/checklists";
import { PortariaClient } from "./portaria-client";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortariaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAppUser();
  const sp = await searchParams;
  const dataSelecionada = sp.data ?? undefined; // "YYYY-MM-DD" ou undefined = hoje
  const rows = await listPortariaForDate(dataSelecionada);

  const kpis = {
    checklistsHoje: rows.filter((r) => r.checklist_id).length,
    liberadas: rows.filter((r) => r.status_portaria === "LIBERADA_SAIDA").length,
    saidasRegistradas: rows.filter((r) => r.status_portaria === "SAIDA_REGISTRADA").length,
    bloqueadas:
      rows.filter((r) => r.status_portaria === "BLOQUEADA_CHECKLIST").length +
      rows.filter((r) => r.status_portaria === "BLOQUEADA_MANUTENCAO").length,
    pendentes: rows.filter((r) => r.status_portaria === "PENDENTE_CHECKLIST").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Portaria</p>
        <h1 className="text-3xl font-semibold tracking-tight">Liberação de frotas</h1>
        <p className="text-sm text-muted-foreground">
          {dataSelecionada ? formatDate(new Date(dataSelecionada + "T12:00:00")) : `Hoje: ${formatDate(new Date())}`}
          {" · "}{rows.length} frota(s)
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Checklists hoje", value: kpis.checklistsHoje, color: "text-blue-600" },
          { label: "Liberadas", value: kpis.liberadas, color: "text-emerald-600" },
          { label: "Saídas", value: kpis.saidasRegistradas, color: "text-blue-500" },
          { label: "Bloqueadas", value: kpis.bloqueadas, color: "text-red-600" },
          { label: "Pendentes", value: kpis.pendentes, color: "text-slate-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <p className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <PortariaClient rows={rows} erro={sp.erro} dataSelecionada={dataSelecionada} />
    </div>
  );
}
