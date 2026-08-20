"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
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
  localizacoes = [],
  setores = [],
}: {
  basePath?: string;
  localizacoes?: string[];
  setores?: string[];
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
  const veiculo = searchParams.get("veiculo") ?? "";
  const localizacao = searchParams.get("localizacao") ?? "";
  const setor = searchParams.get("setor") ?? "";
  const [veiculoQuery, setVeiculoQuery] = useState(veiculo);
  const temFiltro = Boolean(periodo || dataInicio || dataFim || veiculo || localizacao || setor);

  useEffect(() => setVeiculoQuery(veiculo), [veiculo]);

  function pesquisarVeiculo() {
    applyChanges({ veiculo: veiculoQuery.trim(), rota: "" });
  }

  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm" aria-busy={isPending}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(170px,0.8fr)_minmax(220px,1.3fr)_minmax(150px,0.8fr)_minmax(170px,0.9fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_auto] xl:items-end">
        <FilterField label="Período">
          <Select
            value={periodo || "all"}
            onValueChange={(v) => applyChanges({ periodo: v === "all" ? "" : v, dataInicio: "", dataFim: "" })}
          >
            <SelectTrigger aria-label="Filtrar por período">
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

        <FilterField label="Frota ou placa">
          <div className="flex min-w-0">
            <Input
              type="search"
              value={veiculoQuery}
              onChange={(event) => setVeiculoQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  pesquisarVeiculo();
                }
              }}
              placeholder="Ex.: 280 ou TRZ-8G44"
              aria-label="Pesquisar por frota ou placa"
              className="rounded-r-none"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={pesquisarVeiculo}
              disabled={isPending || veiculoQuery.trim() === veiculo}
              aria-label="Pesquisar veículo"
              className="shrink-0 rounded-l-none border-l-0"
            >
              {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
            </Button>
          </div>
        </FilterField>

        <FilterField label="CD">
          <Select
            value={localizacao || "all"}
            onValueChange={(v) => applyChanges({ localizacao: v === "all" ? "" : v })}
          >
            <SelectTrigger aria-label="Filtrar por CD">
              <SelectValue>{localizacao || "Todos os CDs"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os CDs</SelectItem>
              {localizacoes.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Setor">
          <Select
            value={setor || "all"}
            onValueChange={(v) => applyChanges({ setor: v === "all" ? "" : v })}
          >
            <SelectTrigger aria-label="Filtrar por setor">
              <SelectValue>{setor || "Todos os setores"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {setores.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
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
          onClick={() => {
            setVeiculoQuery("");
            startTransition(() => router.replace(basePath, { scroll: false }));
          }}
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
    <div className="min-w-0 space-y-1.5">
      <span className="block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </div>
  );
}
