import { getKitSeguranca } from "@/lib/repos/planejamento";

export const dynamic = "force-dynamic";

export default async function SegurancaPage() {
  const rows = await getKitSeguranca();
  const incompleto = rows.filter((r) => !r.triangulo_ok || !r.extintor_ok || !r.macaco_ok || !r.chave_roda_ok).length;
  const completo = rows.length - incompleto;
  const ok = (v: boolean | null) => <span className={`text-sm ${v ? "text-emerald-600" : "text-red-600"}`}>{v ? "✓" : "✗"}</span>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border bg-emerald-50 border-emerald-200 text-emerald-800 p-4">
          <div className="text-2xl font-bold">{completo}</div>
          <div className="mt-1 text-xs font-medium">Kit completo</div>
        </div>
        <div className="rounded-md border bg-red-50 border-red-200 text-red-800 p-4">
          <div className="text-2xl font-bold">{incompleto}</div>
          <div className="mt-1 text-xs font-medium">Kit incompleto</div>
        </div>
        {(["triangulo_ok","extintor_ok"] as const).map((k) => (
          <div key={k} className="rounded-md border bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold text-red-600">{rows.filter((r) => !r[k]).length}</div>
            <div className="mt-1 text-xs font-medium text-muted-foreground capitalize">{k.replace("_ok","").replace(/_/g," ")} ausente</div>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-md border bg-white">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Kit de segurança ({rows.length})</h2></div>
        <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Frota</th>
                <th className="p-3 text-left">Placa</th>
                <th className="p-3 text-left">Setor</th>
                <th className="p-3 text-center">Triângulo</th>
                <th className="p-3 text-center">Extintor</th>
                <th className="p-3 text-center">Macaco</th>
                <th className="p-3 text-center">Chave roda</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-3 font-medium">{r.frota_numero ?? "—"}</td>
                  <td className="p-3">{r.placa ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.setor ?? "—"}</td>
                  <td className="p-3 text-center">{ok(r.triangulo_ok)}</td>
                  <td className="p-3 text-center">{ok(r.extintor_ok)}</td>
                  <td className="p-3 text-center">{ok(r.macaco_ok)}</td>
                  <td className="p-3 text-center">{ok(r.chave_roda_ok)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
