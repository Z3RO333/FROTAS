import Link from "next/link";
import { Truck } from "lucide-react";
import { listVeiculosComPneus, getPneus } from "@/lib/repos/planejamento";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";

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
    return <EmptyState icon={Truck} title="Sem pneus mapeados" />;
  }

  return (
    <div className="space-y-6">
      <MetricGrid cols={5}>
        <MetricCard label="Total pneus" value={todosPneus.length} icon={Truck} severity="INFO" />
        <MetricCard label="Veículos" value={veiculos.length} icon={Truck} severity="INFO" />
        <MetricCard label="Marcados" value={marcados} severity="OK" />
        <MetricCard label="Sem nº de fogo" value={semFogo} severity="ATENCAO" />
        {topMarcas[0] && (
          <MetricCard
            label={topMarcas[0][0]}
            value={topMarcas[0][1]}
            severity="NEUTRO"
            hint="Marca mais usada"
          />
        )}
      </MetricGrid>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Veículos por pneus mapeados ({veiculos.length})</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Clique para ver o mapa visual dos pneus por posição.
          </p>
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {veiculos.map((v) => {
            const key = v.equipamento ?? v.frota_numero ?? "x";
            const pct = v.total_pneus > 0 ? Math.round((v.marcado / v.total_pneus) * 100) : 0;
            return (
              <Link
                key={key}
                href={`/planejamento/pneus/${encodeURIComponent(key)}`}
                className="group rounded-lg border bg-white p-3 transition-all hover:border-blue-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      Frota {v.frota_numero ?? "—"}
                    </div>
                    <div className="text-[10px] tabular-nums text-muted-foreground">
                      Equip {v.equipamento ?? "—"}
                    </div>
                  </div>
                  <Truck className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-blue-600" />
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-bold tabular-nums text-slate-950">
                      {v.total_pneus}
                    </div>
                    <div className="text-[10px] text-muted-foreground">pneus</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold ${
                        pct === 100
                          ? "text-emerald-600"
                          : pct >= 50
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {pct}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">marcado</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
