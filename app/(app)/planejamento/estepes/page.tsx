import { getEstepes } from "@/lib/repos/planejamento";

export const dynamic = "force-dynamic";

export default async function EstepesPage() {
  const rows = await getEstepes();
  const comEstepe = rows.filter((r) => r.tem_estepe === true).length;
  const semEstepe = rows.filter((r) => r.tem_estepe === false).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border bg-emerald-50 border-emerald-200 text-emerald-800 p-4">
          <div className="text-2xl font-bold">{comEstepe}</div>
          <div className="mt-1 text-xs font-medium">Com estepe</div>
        </div>
        <div className="rounded-md border bg-red-50 border-red-200 text-red-800 p-4">
          <div className="text-2xl font-bold">{semEstepe}</div>
          <div className="mt-1 text-xs font-medium">Sem estepe</div>
        </div>
        <div className="rounded-md border bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold">{rows.length}</div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">Total verificados</div>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border bg-white">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Controle de estepes ({rows.length})</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Frota</th>
                <th className="p-3 text-left">Placa</th>
                <th className="p-3 text-left">Modelo</th>
                <th className="p-3 text-left">Setor</th>
                <th className="p-3 text-center">Estepe</th>
                <th className="p-3 text-left">Verificação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-3 font-medium">{r.frota_numero ?? "—"}</td>
                  <td className="p-3">{r.placa ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.modelo ?? "—"}</td>
                  <td className="p-3 text-xs">{r.setor ?? "—"}</td>
                  <td className="p-3 text-center text-sm">
                    <span className={r.tem_estepe ? "text-emerald-600" : "text-red-600"}>{r.tem_estepe ? "✓" : "✗"}</span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{r.data_verificacao ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
