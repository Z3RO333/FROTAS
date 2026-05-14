import { getDocumentos } from "@/lib/repos/planejamento";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function DocumentosPage() {
  const rows = await getDocumentos();

  const byTipo = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    acc[r.tipo_documento] ??= [];
    acc[r.tipo_documento].push(r);
    return acc;
  }, {});

  const summary = Object.entries(byTipo).map(([tipo, items]) => ({
    tipo,
    total: items.length,
    vencidos: items.filter((i) => i.status === "VENCIDO").length,
    ok: items.filter((i) => i.status === "NO_PRAZO").length,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {summary.map((s) => (
          <div key={s.tipo} className="rounded-md border bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold">{s.tipo}</div>
            <div className="mt-2 flex items-end gap-3">
              <div>
                <div className="text-2xl font-bold text-red-600">{s.vencidos}</div>
                <div className="text-xs text-muted-foreground">vencidos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">{s.ok}</div>
                <div className="text-xs text-muted-foreground">ok</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-md border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Todos os documentos ({rows.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Frota</th>
                <th className="p-3 text-left">Placa</th>
                <th className="p-3 text-left">Tipo</th>
                <th className="p-3 text-left">Vencimento</th>
                <th className="p-3 text-right">Dias passados</th>
                <th className="p-3 text-left">Localização</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.slice(0, 300).map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-3 font-medium">{r.frota_numero ?? "—"}</td>
                  <td className="p-3">{r.placa ?? "—"}</td>
                  <td className="p-3 text-xs">{r.tipo_documento}</td>
                  <td className="p-3 text-xs">{r.data_vencimento ?? "—"}</td>
                  <td className="p-3 text-right text-xs">{r.dias_passados ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.localizacao ?? "—"}</td>
                  <td className="p-3"><StatusBadge status={r.status} /></td>
                  <td className="p-3 text-xs">
                    {r.link_documento && r.link_documento !== "-" ? (
                      <span className="text-blue-600">{r.link_documento}</span>
                    ) : "—"}
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
