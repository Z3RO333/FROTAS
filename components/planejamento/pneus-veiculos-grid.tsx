"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { PneuVeiculoGroup } from "@/lib/repos/planejamento";

export function PneusVeiculosGrid({ veiculos }: { veiculos: PneuVeiculoGroup[] }) {
  const [search, setSearch] = useState("");

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return veiculos;
    return veiculos.filter((v) =>
      [v.frota_numero, v.equipamento].some((campo) => campo?.toLowerCase().includes(term))
    );
  }, [veiculos, search]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="h-1 w-6 rounded-full bg-blue-500" />
          Veículos por pneus mapeados ({filtrados.length})
        </h2>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar frota ou equipamento..."
            className="pl-9"
            aria-label="Buscar frota ou equipamento"
          />
        </div>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState icon={Truck} title="Nenhum veículo encontrado para essa busca" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((v) => {
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
      )}
    </section>
  );
}
