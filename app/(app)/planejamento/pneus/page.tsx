import Link from "next/link";
import { CheckCircle2, Flame, Layers, Tag, Truck } from "lucide-react";
import { listVeiculosComPneus, getPneus } from "@/lib/repos/planejamento";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/progress-bar";

export const dynamic = "force-dynamic";

export default async function PneusPage() {
  const [veiculos, todosPneus] = await Promise.all([
    listVeiculosComPneus(60),
    getPneus(),
  ]);

  const semFogo = todosPneus.filter((r) => !r.numero_fogo || r.numero_fogo === "SEM FOGO").length;
  const marcados = todosPneus.filter((r) => r.marcado).length;

  const byMarca = todosPneus.reduce<Record<string, number>>((acc, r) => {
    const m = r.marca ?? "Sem marca";
    acc[m] = (acc[m] ?? 0) + 1;
    return acc;
  }, {});
  const topMarcas = Object.entries(byMarca).sort((a, b) => b[1] - a[1]).slice(0, 2);

  if (veiculos.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Pneus"
          title="Painel de Pneus"
          description="Nenhum pneu mapeado ainda."
          icon={Truck}
          severity="NEUTRO"
        />
        <EmptyState icon={Truck} title="Sem pneus mapeados" />
      </div>
    );
  }

  // Ordenar: menos marcados primeiro (mais atenção)
  const ordered = [...veiculos].sort((a, b) => {
    const pa = a.total_pneus > 0 ? a.marcado / a.total_pneus : 0;
    const pb = b.total_pneus > 0 ? b.marcado / b.total_pneus : 0;
    return pa - pb;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pneus"
        title="Painel de Pneus"
        description={`${todosPneus.length} pneus em ${veiculos.length} veículos · ${marcados} com número de fogo.`}
        icon={Truck}
        severity={semFogo > 0 ? "ATENCAO" : "OK"}
      />

      <MetricGrid cols={5}>
        <MetricCard label="Total pneus" value={todosPneus.length} icon={Layers} severity="INFO" />
        <MetricCard label="Veículos" value={veiculos.length} icon={Truck} severity="INFO" />
        <MetricCard
          label="Marcados"
          value={marcados}
          icon={CheckCircle2}
          severity="OK"
          hint={`${todosPneus.length > 0 ? Math.round((marcados / todosPneus.length) * 100) : 0}% do total`}
        />
        <MetricCard
          label="Sem nº de fogo"
          value={semFogo}
          icon={Flame}
          severity={semFogo > 0 ? "ATENCAO" : "OK"}
        />
        {topMarcas[0] && (
          <MetricCard
            label={topMarcas[0][0]}
            value={topMarcas[0][1]}
            icon={Tag}
            severity="NEUTRO"
            hint="Marca mais usada"
          />
        )}
      </MetricGrid>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="h-1 w-6 rounded-full bg-blue-500" />
          Veículos por pneus mapeados ({veiculos.length})
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ordered.map((v) => {
            const key = v.equipamento ?? v.frota_numero ?? "x";
            const pct = v.total_pneus > 0 ? Math.round((v.marcado / v.total_pneus) * 100) : 0;
            const borderColor =
              pct === 100 ? "border-l-emerald-500" : pct >= 50 ? "border-l-amber-500" : "border-l-red-500";
            const pctColor =
              pct === 100 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
            return (
              <Link
                key={key}
                href={`/planejamento/pneus/${encodeURIComponent(key)}`}
                className={cn(
                  "group relative overflow-hidden rounded-xl border border-l-4 bg-white p-4 transition-all duration-150",
                  "shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)]",
                  "hover:-translate-y-[1px] hover:border-blue-300 hover:shadow-[0_2px_0_rgba(15,23,42,0.04),0_16px_32px_-12px_rgba(15,23,42,0.22)]",
                  borderColor
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      Frota {v.frota_numero ?? "—"}
                    </div>
                    <div className="mt-0.5 text-[10px] tabular-nums text-slate-500">
                      Equip {v.equipamento ?? "—"}
                    </div>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100 transition-colors group-hover:bg-blue-100">
                    <Truck className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-semibold tabular-nums text-slate-950">{v.total_pneus}</div>
                    <div className="text-[10px] text-slate-500">pneus</div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-sm font-semibold tabular-nums", pctColor)}>{pct}%</div>
                    <div className="text-[10px] text-slate-500">marcado</div>
                  </div>
                </div>

                <ProgressBar
                  className="mt-3"
                  value={pct}
                  tone={pct === 100 ? "emerald" : pct >= 50 ? "amber" : "red"}
                  label={`Pneus marcados da frota ${v.frota_numero ?? "sem número"}: ${pct}%`}
                />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
