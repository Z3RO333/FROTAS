import { getPneus } from "@/lib/repos/planejamento";

export const dynamic = "force-dynamic";

export default async function PneusPage() {
  const rows = await getPneus();
  const byMarca = rows.reduce<Record<string, number>>((acc, r) => {
    const m = r.marca ?? "Sem marca";
    acc[m] = (acc[m] ?? 0) + 1;
    return acc;
  }, {});
  const marcasSorted = Object.entries(byMarca).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const semFogo = rows.filter((r) => !r.numero_fogo || r.numero_fogo === "SEM FOGO").length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div className="rounded-md border bg-blue-50 border-blue-200 text-blue-800 p-4">
          <div className="text-2xl font-bold">{rows.length}</div>
          <div className="mt-1 text-xs font-medium">Total mapeados</div>
        </div>
        <div className="rounded-md border bg-amber-50 border-amber-200 text-amber-800 p-4">
          <div className="text-2xl font-bold">{semFogo}</div>
          <div className="mt-1 text-xs font-medium">Sem nº de fogo</div>
        </div>
        {marcasSorted.map(([marca, qty]) => (
          <div key={marca} className="rounded-md border bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold">{qty}</div>
            <div className="mt-1 text-xs font-medium text-muted-foreground truncate">{marca}</div>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-md border bg-white">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Pneus ({rows.length})</h2></div>
        <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Frota</th>
                <th className="p-3 text-left">Posição</th>
                <th className="p-3 text-left">Nº Fogo</th>
                <th className="p-3 text-left">Marca</th>
                <th className="p-3 text-left">Montagem</th>
                <th className="p-3 text-center">Marcado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-3 font-medium">{r.frota_numero ?? "—"}</td>
                  <td className="p-3 text-xs">{r.posicao}</td>
                  <td className="p-3 text-xs">{r.numero_fogo ?? "—"}</td>
                  <td className="p-3 text-xs">{r.marca ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.dt_montagem ?? "—"}</td>
                  <td className="p-3 text-center text-sm">
                    <span className={r.marcado ? "text-emerald-600" : "text-slate-400"}>{r.marcado ? "✓" : "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
