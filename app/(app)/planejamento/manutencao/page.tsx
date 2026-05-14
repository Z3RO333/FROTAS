import { getManutencao } from "@/lib/repos/planejamento";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="rounded px-2 py-0.5 text-xs bg-slate-100 text-slate-600">—</span>;
  const s = status.toUpperCase();
  const cls = s.includes("VENC") || s.includes("ATRASA") ? "bg-red-100 text-red-800"
    : s.includes("NO_PRAZO") || s.includes("OK") ? "bg-emerald-100 text-emerald-800"
    : "bg-amber-100 text-amber-800";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status.replace(/_/g, " ")}</span>;
}

const TIPO_LABELS: Record<string, string> = {
  AR_CONDICIONADO: "Ar Condicionado",
  ALINHAMENTO: "Alinhamento",
  PREVENTIVA_MOTOR: "Preventiva Motor",
  EMBREAGEM: "Embreagem",
  TACOGRAFO: "Tacógrafo",
  PORTA_ROOL_UP: "Porta Roll Up",
  SUSPENSAO: "Suspensão",
};

export default async function ManutencaoPage() {
  const rows = await getManutencao();

  const byTipo = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    acc[r.tipo_servico] ??= [];
    acc[r.tipo_servico].push(r);
    return acc;
  }, {});

  const summary = Object.entries(byTipo).map(([tipo, items]) => ({
    tipo,
    total: items.length,
    ok: items.filter((i) => i.status === "NO_PRAZO").length,
    atrasado: items.filter((i) => i.status !== "NO_PRAZO" && i.status !== null).length,
    sem_data: items.filter((i) => !i.data_realizada).length,
  }));

  const atrasadas = rows.filter((r) => r.status !== "NO_PRAZO" && r.status !== null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {summary.map((s) => (
          <div key={s.tipo} className="rounded-md border bg-white p-3 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground">{TIPO_LABELS[s.tipo] ?? s.tipo}</div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-2xl font-bold text-red-600">{s.atrasado}</span>
              <span className="text-xs text-muted-foreground mb-0.5">/ {s.total}</span>
            </div>
            <div className="mt-1 text-xs text-emerald-700">{s.ok} OK</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-md border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Itens com atenção ({atrasadas.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Frota</th>
                <th className="p-3 text-left">Placa</th>
                <th className="p-3 text-left">Serviço</th>
                <th className="p-3 text-left">Última data</th>
                <th className="p-3 text-right">Desvio</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {atrasadas.slice(0, 200).map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-3 font-medium">{r.frota_numero ?? "—"}</td>
                  <td className="p-3">{r.placa ?? "—"}</td>
                  <td className="p-3 text-xs">{TIPO_LABELS[r.tipo_servico] ?? r.tipo_servico}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.data_realizada ?? "—"}</td>
                  <td className="p-3 text-right text-xs">{r.desvio != null ? r.desvio.toLocaleString("pt-BR") : "—"}</td>
                  <td className="p-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
