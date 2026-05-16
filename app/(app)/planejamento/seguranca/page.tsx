import { AlertTriangle, CheckCircle2, Flame, ShieldAlert, Triangle, Wrench } from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { getKitSeguranca } from "@/lib/repos/planejamento";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { SEVERITY } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ITEMS: Array<{
  key: "triangulo_ok" | "extintor_ok" | "macaco_ok" | "chave_roda_ok";
  label: string;
  icon: ComponentType<LucideProps>;
}> = [
  { key: "triangulo_ok", label: "Triângulo", icon: Triangle },
  { key: "extintor_ok", label: "Extintor", icon: Flame },
  { key: "macaco_ok", label: "Macaco", icon: Wrench },
  { key: "chave_roda_ok", label: "Chave de roda", icon: Wrench },
];

export default async function SegurancaPage() {
  const rows = await getKitSeguranca();
  const incompleto = rows.filter(
    (r) => !r.triangulo_ok || !r.extintor_ok || !r.macaco_ok || !r.chave_roda_ok
  ).length;
  const completo = rows.length - incompleto;

  // Faltas por item
  const faltasPorItem = ITEMS.map(({ key, label }) => ({
    key,
    label,
    falta: rows.filter((r) => !r[key]).length,
  }));

  // Ordenar: incompletos primeiro
  const ordered = [...rows].sort((a, b) => {
    const ai = a.triangulo_ok && a.extintor_ok && a.macaco_ok && a.chave_roda_ok ? 1 : 0;
    const bi = b.triangulo_ok && b.extintor_ok && b.macaco_ok && b.chave_roda_ok ? 1 : 0;
    return ai - bi;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manutenção"
        title="Kit de Segurança"
        description={`${rows.length} frotas verificadas · ${incompleto} com kit incompleto.`}
        icon={ShieldAlert}
        severity={incompleto > 0 ? "CRITICO" : "OK"}
      />

      <MetricGrid cols={2}>
        <MetricCard
          label="Kit completo"
          value={completo}
          icon={CheckCircle2}
          severity="OK"
          hint={`${rows.length > 0 ? Math.round((completo / rows.length) * 100) : 0}% das frotas`}
        />
        <MetricCard
          label="Kit incompleto"
          value={incompleto}
          icon={AlertTriangle}
          severity={incompleto > 0 ? "CRITICO" : "OK"}
          hint="Bloqueia a saída"
        />
      </MetricGrid>

      {/* Faltas por item */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="h-1 w-6 rounded-full bg-rose-500" />
          Itens em falta por categoria
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {faltasPorItem.map(({ key, label, falta }) => {
            const severity = falta === 0 ? "OK" : falta < 5 ? "ATENCAO" : "CRITICO";
            const tone = SEVERITY[severity];
            const Icon = ITEMS.find((i) => i.key === key)?.icon ?? Wrench;
            return (
              <div
                key={key}
                className="group relative overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] transition-all duration-150 hover:-translate-y-[1px]"
              >
                <span className={cn("pointer-events-none absolute inset-x-0 top-0 h-[3px]", tone.bar)} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500 truncate">
                      {label} ausente
                    </p>
                    <div className={cn("mt-2 text-3xl font-semibold tabular-nums", tone.icon)}>{falta}</div>
                  </div>
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone.tile)}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Lista detalhada */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="h-1 w-6 rounded-full bg-blue-500" />
          Frotas verificadas ({rows.length})
        </h2>

        {/* Cards mobile */}
        <div className="grid gap-3 md:hidden">
          {ordered.map((r, i) => {
            const completo =
              r.triangulo_ok && r.extintor_ok && r.macaco_ok && r.chave_roda_ok;
            return (
              <div
                key={`sc-${i}`}
                className={cn(
                  "rounded-xl border border-l-4 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]",
                  completo ? "border-l-emerald-500" : "border-l-red-500"
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
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                      completo
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-red-50 text-red-700 ring-red-200"
                    )}
                  >
                    {completo ? "Completo" : "Incompleto"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                  {ITEMS.map(({ key, label }) => (
                    <ItemBadge key={key} label={label} ok={r[key]} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabela desktop */}
        <div className="hidden overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] md:block">
          <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                <tr>
                  <th className="p-3 text-left">Frota</th>
                  <th className="p-3 text-left">Placa</th>
                  <th className="p-3 text-left">Setor</th>
                  {ITEMS.map(({ key, label }) => (
                    <th key={key} className="p-3 text-center">
                      {label}
                    </th>
                  ))}
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordered.map((r, i) => {
                  const completo =
                    r.triangulo_ok && r.extintor_ok && r.macaco_ok && r.chave_roda_ok;
                  return (
                    <tr key={`sr-${i}`} className="transition-colors hover:bg-blue-50/40">
                      <td className="p-3 font-medium text-slate-900">{r.frota_numero ?? "—"}</td>
                      <td className="p-3 font-mono text-xs text-slate-700">{r.placa ?? "—"}</td>
                      <td className="p-3 text-xs text-slate-500">{r.setor ?? "—"}</td>
                      {ITEMS.map(({ key }) => (
                        <td key={key} className="p-3 text-center">
                          <CheckDot ok={r[key]} />
                        </td>
                      ))}
                      <td className="p-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                            completo
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-red-50 text-red-700 ring-red-200"
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              completo ? "bg-emerald-500" : "bg-red-500"
                            )}
                          />
                          {completo ? "Completo" : "Incompleto"}
                        </span>
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

function ItemBadge({ label, ok }: { label: string; ok: boolean | null }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-md px-1.5 py-1 ring-1 ring-inset",
        ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"
      )}
    >
      <CheckDot ok={ok} />
      <span className="truncate text-[10px] font-medium">{label.split(" ")[0]}</span>
    </div>
  );
}

function CheckDot({ ok }: { ok: boolean | null }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ring-1 ring-inset",
        ok
          ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
          : "bg-red-100 text-red-700 ring-red-200"
      )}
      aria-label={ok ? "OK" : "Ausente"}
    >
      {ok ? "✓" : "✗"}
    </span>
  );
}
