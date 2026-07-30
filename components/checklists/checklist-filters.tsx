"use client";

import { useTransition } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PERIODOS = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "semana_atual", label: "Esta semana" },
  { value: "semana_passada", label: "Semana passada" },
  { value: "ultimos_30_dias", label: "Últimos 30 dias" },
];

export function ChecklistFilters({
  basePath = "/checklists",
  routes = [],
}: {
  basePath?: string;
  routes?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function applyChanges(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    });
  }

  const periodo = searchParams.get("periodo") ?? "";
  const dataInicio = searchParams.get("dataInicio") ?? "";
  const dataFim = searchParams.get("dataFim") ?? "";
  const rota = searchParams.get("rota") ?? "";
  const temFiltro = Boolean(periodo || dataInicio || dataFim || rota);

  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm" aria-busy={isPending}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(170px,0.8fr)_minmax(220px,1.3fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_auto] xl:items-end">
        <FilterField label="Período">
          <Select
            value={periodo || "all"}
            onValueChange={(v) => applyChanges({ periodo: v === "all" ? "" : v, dataInicio: "", dataFim: "" })}
          >
            <SelectTrigger>
              <SelectValue>
                {PERIODOS.find((item) => item.value === periodo)?.label ?? "Todo o período"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o período</SelectItem>
              {PERIODOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Rota / unidade">
          <Select value={rota || "all"} onValueChange={(v) => applyChanges({ rota: v === "all" ? "" : v })}>
            <SelectTrigger aria-label="Filtrar por rota ou unidade">
              <span className="flex min-w-0 items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
                <SelectValue>{rota || "Todas as rotas"}</SelectValue>
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as rotas</SelectItem>
              {routes.map((route) => (
                <SelectItem key={route} value={route}>
                  {route}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Data inicial">
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => applyChanges({ dataInicio: e.target.value, periodo: "" })}
            aria-label="Data inicial"
          />
        </FilterField>
        <FilterField label="Data final">
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => applyChanges({ dataFim: e.target.value, periodo: "" })}
            aria-label="Data final"
          />
        </FilterField>

        <Button
          variant="outline"
          onClick={() => startTransition(() => router.replace(basePath, { scroll: false }))}
          className="w-full gap-1.5 sm:w-auto"
          disabled={!temFiltro || isPending}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
          {isPending ? "Atualizando" : "Limpar filtros"}
        </Button>
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="min-w-0 space-y-1.5">
      <span className="block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
