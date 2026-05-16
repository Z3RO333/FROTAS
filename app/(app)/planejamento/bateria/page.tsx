import { Battery, BatteryWarning, CalendarClock, Layers } from "lucide-react";
import { getBateria } from "@/lib/repos/planejamento";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

// Garantia típica de bateria: 12 meses
const GARANTIA_DIAS = 365;

export default async function BateriaPage() {
  const rows = await getBateria();
  const semData = rows.filter((r) => !r.data_compra).length;
  const comData = rows.length - semData;

  // Quantas estão fora da garantia (> 365 dias desde compra)
  const foraGarantia = rows.filter((r) => {
    const d = diasDesde(r.data_compra);
    return d != null && d > GARANTIA_DIAS;
  }).length;

  // Ordenar: mais antigas primeiro (próximas de vencer garantia)
  const ordered = [...rows].sort((a, b) => {
    const da = a.data_compra ? new Date(a.data_compra).getTime() : Infinity;
    const db = b.data_compra ? new Date(b.data_compra).getTime() : Infinity;
    return da - db;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manutenção"
        title="Controle de Baterias"
        description={`${rows.length} registros · garantia padrão de ${GARANTIA_DIAS} dias após a compra.`}
        icon={Battery}
        severity={foraGarantia > 0 ? "ATENCAO" : "OK"}
      />

      <MetricGrid cols={4}>
        <MetricCard label="Total registros" value={rows.length} icon={Layers} severity="INFO" />
        <MetricCard
          label="Com data lançada"
          value={comData}
          icon={CalendarClock}
          severity="OK"
          hint={`${rows.length > 0 ? Math.round((comData / rows.length) * 100) : 0}% do total`}
        />
        <MetricCard
          label="Sem data de compra"
          value={semData}
          icon={CalendarClock}
          severity="ATENCAO"
          hint="Risco de garantia perdida"
        />
        <MetricCard
          label="Fora da garantia"
          value={foraGarantia}
          icon={BatteryWarning}
          severity={foraGarantia > 0 ? "CRITICO" : "OK"}
          hint={`> ${GARANTIA_DIAS} dias`}
        />
      </MetricGrid>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="h-1 w-6 rounded-full bg-violet-500" />
          Controle de baterias ({rows.length})
        </h2>

        {/* Cards mobile */}
        <div className="grid gap-3 md:hidden">
          {ordered.map((r, i) => {
            const dias = diasDesde(r.data_compra);
            const fora = dias != null && dias > GARANTIA_DIAS;
            const proximo = dias != null && dias > GARANTIA_DIAS - 30 && dias <= GARANTIA_DIAS;
            const borderColor = fora ? "border-l-red-500" : proximo ? "border-l-amber-500" : "border-l-emerald-500";
            return (
              <div
                key={`bc-${i}`}
                className={cn(
                  "rounded-xl border border-l-4 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]",
                  r.data_compra ? borderColor : "border-l-slate-300"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{r.frota_numero ?? "—"}</span>
                      {r.placa && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                          {r.placa}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{r.setor ?? "—"}</p>
                  </div>
                  {dias != null && (
                    <span
                      className={cn(
                        "shrink-0 text-[11px] font-semibold tabular-nums",
                        fora ? "text-red-600" : proximo ? "text-amber-600" : "text-emerald-700"
                      )}
                    >
                      {dias}d
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                  <span className="text-slate-500">Compra: {r.data_compra ?? "—"}</span>
                  <span className="text-slate-500 truncate">{r.modelo_bateria ?? "—"}</span>
                  <span className="col-span-2 text-slate-400 truncate">{r.loja ?? ""}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabela desktop */}
        <div className="hidden overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3 text-left">Frota</th>
                  <th className="p-3 text-left">Placa</th>
                  <th className="p-3 text-left">Setor</th>
                  <th className="p-3 text-left">Data compra</th>
                  <th className="p-3 text-right">Idade</th>
                  <th className="p-3 text-left">Modelo</th>
                  <th className="p-3 text-left">Loja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordered.map((r, i) => {
                  const dias = diasDesde(r.data_compra);
                  const fora = dias != null && dias > GARANTIA_DIAS;
                  const proximo = dias != null && dias > GARANTIA_DIAS - 30 && dias <= GARANTIA_DIAS;
                  return (
                    <tr key={`br-${i}`} className="transition-colors hover:bg-blue-50/40">
                      <td className="p-3 font-medium text-slate-900">{r.frota_numero ?? "—"}</td>
                      <td className="p-3 font-mono text-xs text-slate-700">{r.placa ?? "—"}</td>
                      <td className="p-3 text-xs text-slate-500">{r.setor ?? "—"}</td>
                      <td className="p-3 text-xs text-slate-600 tabular-nums">{r.data_compra ?? "—"}</td>
                      <td
                        className={cn(
                          "p-3 text-right text-xs font-semibold tabular-nums",
                          fora ? "text-red-600" : proximo ? "text-amber-600" : "text-slate-500"
                        )}
                      >
                        {dias != null ? `${dias}d` : "—"}
                      </td>
                      <td className="p-3 text-xs text-slate-700">{r.modelo_bateria ?? "—"}</td>
                      <td className="p-3 text-xs text-slate-500">{r.loja ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
