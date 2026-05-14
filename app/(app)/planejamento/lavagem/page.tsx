import { getLavagem } from "@/lib/repos/planejamento";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="rounded px-2 py-0.5 text-xs bg-slate-100 text-slate-600">—</span>;
  const cls = status.toUpperCase().includes("LAVAGEM") ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export default async function LavagemPage() {
  const rows = await getLavagem();
  const atrasadas = rows.filter((r) => (r.atraso_dias ?? 0) > 0).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border bg-red-50 border-red-200 text-red-800 p-4">
          <div className="text-2xl font-bold">{atrasadas}</div>
          <div className="mt-1 text-xs font-medium">Atrasadas</div>
        </div>
        <div className="rounded-md border bg-emerald-50 border-emerald-200 text-emerald-800 p-4">
          <div className="text-2xl font-bold">{rows.length - atrasadas}</div>
          <div className="mt-1 text-xs font-medium">Em dia</div>
        </div>
        <div className="rounded-md border bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold">{rows.length}</div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">Total</div>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border bg-white">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Controle de lavagem ({rows.length})</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Frota</th>
                <th className="p-3 text-left">Placa</th>
                <th className="p-3 text-left">Setor</th>
                <th className="p-3 text-left">Última lavagem</th>
                <th className="p-3 text-right">Atraso (dias)</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-3 font-medium">{r.frota_numero ?? "—"}</td>
                  <td className="p-3">{r.placa ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.setor ?? "—"}</td>
                  <td className="p-3 text-xs">{r.data_realizada ?? "—"}</td>
                  <td className={`p-3 text-right font-medium ${(r.atraso_dias ?? 0) > 0 ? "text-red-600" : "text-emerald-700"}`}>{r.atraso_dias ?? 0}</td>
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
