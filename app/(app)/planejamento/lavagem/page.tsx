import { AlertTriangle, CheckCircle2, Droplets, Layers } from "lucide-react";
import { getLavagem } from "@/lib/repos/planejamento";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LavagemPage() {
  const rows = await getLavagem();
  const atrasadas = rows.filter((r) => (r.atraso_dias ?? 0) > 0);
  const emDia = rows.length - atrasadas.length;

  // Pico de atraso (>= 7 dias)
  const criticas = atrasadas.filter((r) => (r.atraso_dias ?? 0) >= 7).length;

  // Lista ordenada: piores atrasos primeiro
  const ordered = [...rows].sort((a, b) => (b.atraso_dias ?? 0) - (a.atraso_dias ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manutenção"
        title="Controle de Lavagem"
        description={`${rows.length} frotas monitoradas · ${atrasadas.length} fora do prazo, ${emDia} em dia.`}
        icon={Droplets}
        severity={atrasadas.length > 0 ? "ATENCAO" : "OK"}
      />

      <MetricGrid cols={4}>
        <MetricCard label="Total monitoradas" value={rows.length} icon={Layers} severity="INFO" />
        <MetricCard
          label="Em dia"
          value={emDia}
          icon={CheckCircle2}
          severity="OK"
          hint={`${rows.length > 0 ? Math.round((emDia / rows.length) * 100) : 0}% do total`}
        />
        <MetricCard
          label="Atrasadas"
          value={atrasadas.length}
          icon={AlertTriangle}
          severity={atrasadas.length > 0 ? "ATENCAO" : "OK"}
        />
        <MetricCard
          label="≥ 7 dias atrasado"
          value={criticas}
          icon={AlertTriangle}
          severity={criticas > 0 ? "CRITICO" : "OK"}
          hint="Risco operacional alto"
        />
      </MetricGrid>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="h-1 w-6 rounded-full bg-blue-500" />
          Controle de lavagem ({rows.length})
        </h2>

        {/* Cards mobile */}
        <div className="grid gap-3 md:hidden">
          {ordered.map((r, i) => {
            const atraso = r.atraso_dias ?? 0;
            const borderColor =
              atraso >= 7 ? "border-l-red-500" : atraso > 0 ? "border-l-amber-500" : "border-l-emerald-500";
            return (
              <div
                key={`lc-${i}`}
                className={cn(
                  "rounded-xl border border-l-4 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]",
                  borderColor
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {r.frota_numero ?? "—"}
                      </span>
                      {r.placa && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                          {r.placa}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{r.setor ?? "—"}</p>
                  </div>
                  <StatusBadge status={r.status} size="sm" />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Última: {r.data_realizada ?? "—"}</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      atraso >= 7 ? "text-red-600" : atraso > 0 ? "text-amber-600" : "text-emerald-700"
                    )}
                  >
                    {atraso > 0 ? `+${atraso}d` : "no prazo"}
                  </span>
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
                  <th className="p-3 text-left">Última lavagem</th>
                  <th className="p-3 text-right">Atraso</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordered.map((r, i) => {
                  const atraso = r.atraso_dias ?? 0;
                  return (
                    <tr key={`lr-${i}`} className="transition-colors hover:bg-blue-50/40">
                      <td className="p-3 font-medium text-slate-900">{r.frota_numero ?? "—"}</td>
                      <td className="p-3 font-mono text-xs text-slate-700">{r.placa ?? "—"}</td>
                      <td className="p-3 text-xs text-slate-500">{r.setor ?? "—"}</td>
                      <td className="p-3 text-xs text-slate-600 tabular-nums">{r.data_realizada ?? "—"}</td>
                      <td
                        className={cn(
                          "p-3 text-right text-xs font-semibold tabular-nums",
                          atraso >= 7 ? "text-red-600" : atraso > 0 ? "text-amber-600" : "text-emerald-700"
                        )}
                      >
                        {atraso > 0 ? `+${atraso} dias` : "no prazo"}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={r.status} />
                      </td>
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
