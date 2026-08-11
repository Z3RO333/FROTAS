import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Cog,
  Fan,
  Gauge,
  ShieldAlert,
  Snowflake,
  Wrench,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { getManutencao } from "@/lib/repos/planejamento";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { SEVERITY, severityFromStatus } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { ServiceNavigation } from "@/components/manutencao/service-navigation";

export const dynamic = "force-dynamic";

const TIPO_LABELS: Record<string, string> = {
  AR_CONDICIONADO: "Ar Condicionado",
  ALINHAMENTO: "Alinhamento",
  PREVENTIVA_MOTOR: "Preventiva Motor",
  EMBREAGEM: "Embreagem",
  TACOGRAFO: "Tacógrafo",
  PORTA_ROOL_UP: "Porta Roll Up",
  SUSPENSAO: "Suspensão",
};

const TIPO_ICONS: Record<string, ComponentType<LucideProps>> = {
  AR_CONDICIONADO: Snowflake,
  ALINHAMENTO: Gauge,
  PREVENTIVA_MOTOR: Cog,
  EMBREAGEM: Wrench,
  TACOGRAFO: ClipboardCheck,
  PORTA_ROOL_UP: ShieldAlert,
  SUSPENSAO: Fan,
};

export default async function ManutencaoPage() {
  const rows = await getManutencao();

  const byTipo = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    acc[r.tipo_servico] ??= [];
    acc[r.tipo_servico].push(r);
    return acc;
  }, {});

  const summary = Object.entries(byTipo).map(([tipo, items]) => ({
    tipo,
    total: items.length,
    ok: items.filter((i) => i.status === "NO_PRAZO").length,
    atrasado: items.filter((i) => i.status !== "NO_PRAZO" && i.status !== null).length,
    sem_data: items.filter((i) => !i.data_realizada).length,
  }));

  const atrasadas = rows.filter((r) => r.status !== "NO_PRAZO" && r.status !== null);

  const totalAtrasado = atrasadas.length;
  const totalNoPrazo = rows.filter((r) => r.status === "NO_PRAZO").length;
  const totalSemData = rows.filter((r) => !r.data_realizada).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manutenção"
        title="Radar de Preventivas"
        description={`${rows.length} controles ativos · ${totalAtrasado} fora do prazo, ${totalNoPrazo} em dia.`}
        icon={Wrench}
        severity={totalAtrasado > 0 ? "ATENCAO" : "OK"}
      />

      <MetricGrid cols={3}>
        <MetricCard
          label="Em dia"
          value={totalNoPrazo}
          icon={CheckCircle2}
          severity="OK"
          hint={`${rows.length > 0 ? Math.round((totalNoPrazo / rows.length) * 100) : 0}% do total`}
        />
        <MetricCard
          label="Fora do prazo"
          value={totalAtrasado}
          icon={AlertTriangle}
          severity="CRITICO"
          hint={atrasadas[0] ? `Maior desvio: ${atrasadas[0].frota_numero ?? "—"}` : "Sem atrasos"}
        />
        <MetricCard
          label="Sem registro"
          value={totalSemData}
          icon={CalendarClock}
          severity="ATENCAO"
          hint="Nunca tiveram data lançada"
        />
      </MetricGrid>

      <ServiceNavigation />

      {/* Cards por tipo de serviço */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="h-1 w-6 rounded-full bg-violet-500" />
          Por tipo de serviço
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {summary
            .sort((a, b) => b.atrasado - a.atrasado)
            .map((s) => {
              const Icon = TIPO_ICONS[s.tipo] ?? Wrench;
              const severity = s.atrasado > 0 ? "CRITICO" : s.sem_data > 0 ? "ATENCAO" : "OK";
              const tone = SEVERITY[severity];
              return (
                <div
                  key={s.tipo}
                  className="group relative overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[0_2px_0_rgba(15,23,42,0.04),0_16px_32px_-12px_rgba(15,23,42,0.22)]"
                >
                  <span className={cn("pointer-events-none absolute inset-x-0 top-0 h-[3px]", tone.bar)} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {TIPO_LABELS[s.tipo] ?? s.tipo}
                      </p>
                      <div className="mt-2 flex items-end gap-2">
                        <span className={cn("text-3xl font-semibold tabular-nums", tone.icon)}>
                          {s.atrasado}
                        </span>
                        <span className="mb-1 text-xs text-slate-400">/ {s.total}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span className="text-emerald-700">{s.ok} no prazo</span>
                        {s.sem_data > 0 && <span className="text-amber-700">{s.sem_data} sem data</span>}
                      </div>
                    </div>
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tone.tile)}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* Lista de itens com atenção */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="h-1 w-6 rounded-full bg-red-500" />
          Itens fora do prazo ({atrasadas.length})
        </h2>

        {atrasadas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-12 text-center text-sm text-slate-500">
            Nenhum item fora do prazo. Tudo no verde.
          </div>
        ) : (
          <>
            {/* Cards mobile */}
            <div className="grid gap-3 md:hidden">
              {atrasadas.slice(0, 200).map((r, i) => (
                <AtencaoCard key={`m-${i}`} row={r} />
              ))}
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
                      <th className="p-3 text-left">Serviço</th>
                      <th className="p-3 text-left">Última data</th>
                      <th className="p-3 text-right">Desvio</th>
                      <th className="p-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {atrasadas.slice(0, 200).map((r, i) => {
                      const Icon = TIPO_ICONS[r.tipo_servico] ?? Wrench;
                      const severity = severityFromStatus(r.status);
                      const tone = SEVERITY[severity];
                      return (
                        <tr key={`r-${i}`} className="transition-colors hover:bg-blue-50/40">
                          <td className="p-3 font-medium text-slate-900">{r.frota_numero ?? "—"}</td>
                          <td className="p-3 font-mono text-xs text-slate-700">{r.placa ?? "—"}</td>
                          <td className="p-3 text-xs text-slate-500">{r.setor ?? "—"}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", tone.tile)}>
                                <Icon className="h-3 w-3" aria-hidden="true" />
                              </span>
                              <span className="text-xs">{TIPO_LABELS[r.tipo_servico] ?? r.tipo_servico}</span>
                            </span>
                          </td>
                          <td className="p-3 text-xs text-slate-600 tabular-nums">{r.data_realizada ?? "—"}</td>
                          <td className="p-3 text-right text-xs tabular-nums">
                            {r.desvio != null ? (
                              <span className={cn("font-medium", r.desvio < 0 ? "text-red-600" : "text-slate-500")}>
                                {r.desvio.toLocaleString("pt-BR")}
                              </span>
                            ) : (
                              "—"
                            )}
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
          </>
        )}
      </section>

      {/* Link rápido pra detalhe de tacógrafo */}
      <Link
        href="/planejamento/manutencao/tacografo"
        className="group inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
      >
        Ver detalhe de Tacógrafo
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

type ManutencaoRowMin = {
  frota_numero: string | null;
  placa: string | null;
  setor: string | null;
  tipo_servico: string;
  data_realizada: string | null;
  desvio: number | null;
  status: string | null;
};

function AtencaoCard({ row }: { row: ManutencaoRowMin }) {
  const Icon = TIPO_ICONS[row.tipo_servico] ?? Wrench;
  const severity = severityFromStatus(row.status);
  const tone = SEVERITY[severity];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-l-4 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]",
        severity === "CRITICO"
          ? "border-l-red-500"
          : severity === "ATENCAO"
            ? "border-l-amber-500"
            : "border-l-slate-300"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", tone.tile)}>
              <Icon className="h-3 w-3" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {row.frota_numero ?? row.placa ?? "—"}
            </span>
            {row.placa && (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                {row.placa}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {TIPO_LABELS[row.tipo_servico] ?? row.tipo_servico}
            {row.setor ? ` · ${row.setor}` : ""}
          </p>
        </div>
        <StatusBadge status={row.status} size="sm" />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-slate-500">{row.data_realizada ?? "Sem data"}</span>
        {row.desvio != null && (
          <span className={cn("font-medium tabular-nums", row.desvio < 0 ? "text-red-600" : "text-slate-500")}>
            {row.desvio.toLocaleString("pt-BR")} km
          </span>
        )}
      </div>
    </div>
  );
}
