"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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

  const applyChanges = useCallback((changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    });
  }, [basePath, router, searchParams]);

  const periodo = searchParams.get("periodo") ?? "";
  const dataInicio = searchParams.get("dataInicio") ?? "";
  const dataFim = searchParams.get("dataFim") ?? "";
  const veiculo = searchParams.get("veiculo") ?? "";
  const localizacao = searchParams.get("localizacao") ?? "";
  const setor = searchParams.get("setor") ?? "";
  const status = searchParams.get("status") ?? "";
  const [veiculoQuery, setVeiculoQuery] = useState(veiculo);
  const temFiltro = Boolean(periodo || dataInicio || dataFim || veiculo || localizacao || setor || status);

  useEffect(() => setVeiculoQuery(veiculo), [veiculo]);

  useEffect(() => {
    const query = veiculoQuery.trim();
    if (query === veiculo) return;

    const timer = window.setTimeout(() => {
      applyChanges({ veiculo: query, rota: "" });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [applyChanges, veiculo, veiculoQuery]);

  return (
    <div className="relative" aria-busy={isPending}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.25fr)_minmax(0,0.85fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_auto] 2xl:items-end">
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
          <div className="relative min-w-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={veiculoQuery}
              onChange={(event) => setVeiculoQuery(event.target.value)}
              placeholder="Ex.: 280 ou TRZ-8G44"
              aria-label="Pesquisar por frota ou placa"
              className="pl-9 pr-9"
              autoComplete="off"
            />
            {isPending && veiculoQuery.trim() !== veiculo ? (
              <Loader2
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-600"
                aria-label="Atualizando resultados"
              />
            ) : null}
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

        <FilterField label="Status">
          <Select
            value={status || "all"}
            onValueChange={(v) => applyChanges({ status: v === "all" ? "" : v })}
          >
            <SelectTrigger aria-label="Filtrar por status">
              <SelectValue>
                {status === "APROVADO"
                  ? "Aprovado"
                  : status === "COM_OBSERVACAO"
                    ? "Com observação"
                    : status === "NAO_APTO"
                      ? "Não apto"
                      : status === "CRITICO"
                        ? "Crítico"
                        : "Todos os status"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="APROVADO">Aprovado</SelectItem>
              <SelectItem value="COM_OBSERVACAO">Com observação</SelectItem>
              <SelectItem value="NAO_APTO">Não apto</SelectItem>
              <SelectItem value="CRITICO">Crítico</SelectItem>
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
