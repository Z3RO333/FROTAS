import { getBateria } from "@/lib/repos/planejamento";

export const dynamic = "force-dynamic";

export default async function BateriaPage() {
  const rows = await getBateria();
  const semData = rows.filter((r) => !r.data_compra).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border bg-blue-50 border-blue-200 text-blue-800 p-4">
          <div className="text-2xl font-bold">{rows.length}</div>
          <div className="mt-1 text-xs font-medium">Total registros</div>
        </div>
        <div className="rounded-md border bg-amber-50 border-amber-200 text-amber-800 p-4">
          <div className="text-2xl font-bold">{semData}</div>
          <div className="mt-1 text-xs font-medium">Sem data de compra</div>
        </div>
        <div className="rounded-md border bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold">{rows.length - semData}</div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">Com data registrada</div>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border bg-white">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Controle de baterias ({rows.length})</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Frota</th>
                <th className="p-3 text-left">Placa</th>
                <th className="p-3 text-left">Setor</th>
                <th className="p-3 text-left">Data compra</th>
                <th className="p-3 text-left">Modelo</th>
                <th className="p-3 text-left">Loja</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-3 font-medium">{r.frota_numero ?? "—"}</td>
                  <td className="p-3">{r.placa ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.setor ?? "—"}</td>
                  <td className="p-3 text-xs">{r.data_compra ?? "—"}</td>
                  <td className="p-3 text-xs">{r.modelo_bateria ?? "—"}</td>
                  <td className="p-3 text-xs">{r.loja ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
