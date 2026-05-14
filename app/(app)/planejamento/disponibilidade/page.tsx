import { getDisponibilidade, getDisponibilidadePorTipo } from "@/lib/repos/planejamento";

export const dynamic = "force-dynamic";

export default async function DisponibilidadePage() {
  const [serie, porTipo] = await Promise.all([getDisponibilidade(90), getDisponibilidadePorTipo()]);

  const last = serie[serie.length - 1];
  const avg = serie.length > 0
    ? serie.reduce((s, r) => s + (r.disponibilidade ?? 0), 0) / serie.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground">Último registro</div>
          <div className="mt-1 text-2xl font-bold text-blue-700">
            {last ? `${(((last.disponibilidade ?? 0)) * 100).toFixed(1)}%` : "—"}
          </div>
          <div className="text-xs text-muted-foreground">{last?.data ?? ""}</div>
        </div>
        <div className="rounded-md border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground">Média (90 dias)</div>
          <div className="mt-1 text-2xl font-bold text-blue-700">{(avg * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded-md border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground">Parados (último)</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{last?.parados ?? "—"}</div>
          <div className="text-xs text-muted-foreground">de {last?.total ?? "—"} frotas</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-md border bg-white">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Por tipo de equipamento (último dia)</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Tipo</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Parados</th>
                <th className="p-3 text-right">Disponib.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {porTipo.map((r) => {
                const pct = ((r.disponibilidade ?? 0) * 100).toFixed(1);
                const cls = (r.disponibilidade ?? 0) < 0.9 ? "text-red-600" : "text-emerald-700";
                return (
                  <tr key={r.tipo_equipamento} className="hover:bg-slate-50">
                    <td className="p-3 font-medium">{r.tipo_equipamento}</td>
                    <td className="p-3 text-right">{r.total}</td>
                    <td className="p-3 text-right text-amber-600">{r.parados}</td>
                    <td className={`p-3 text-right font-semibold ${cls}`}>{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-md border bg-white">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Histórico (últimos 90 dias)</h2>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Data</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Parados</th>
                  <th className="p-3 text-right">Disponib.</th>
                  <th className="p-3 text-right">Meta</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...serie].reverse().map((r) => {
                  const pct = ((r.disponibilidade ?? 0) * 100).toFixed(1);
                  const meta = ((r.meta ?? 0.9) * 100).toFixed(0);
                  const atingiu = (r.disponibilidade ?? 0) >= (r.meta ?? 0.9);
                  return (
                    <tr key={r.data} className="hover:bg-slate-50">
                      <td className="p-3 text-xs">{r.data}</td>
                      <td className="p-3 text-right">{r.total}</td>
                      <td className="p-3 text-right text-amber-600">{r.parados}</td>
                      <td className={`p-3 text-right font-medium ${atingiu ? "text-emerald-700" : "text-red-600"}`}>{pct}%</td>
                      <td className="p-3 text-right text-muted-foreground">{meta}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
