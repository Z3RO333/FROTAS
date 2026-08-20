"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterChip, FilterSearch } from "@/components/ui/filter-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { withQuery } from "@/lib/navigation/search-state";

type Props = {
  modelos: string[];
  localizacoes: string[];
  cds: string[];
  basePath?: string;
};

const OPERACIONAIS = [
  { value: "disponivel", label: "Disponível" },
  { value: "manutencao", label: "Em manutenção" },
  { value: "indisponivel", label: "Indisponível" },
];

const CONDICOES = [
  { value: "normal", label: "Normal" },
  { value: "atencao", label: "Atenção" },
  { value: "critico", label: "Crítico" },
];

type Patch = Record<string, string | null | undefined>;

export function FrotasFilters({ modelos, localizacoes, cds, basePath = "/frotas" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(
    () => searchParams.get("q") ?? searchParams.get("frota") ?? searchParams.get("placa") ?? ""
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const applyChanges = useCallback(
    (patch: Patch) => {
      const url = withQuery(basePath, searchParams, { ...patch, page: null });
      startTransition(() => router.replace(url, { scroll: false }));
    },
    [basePath, router, searchParams]
  );

  const update = useCallback((key: string, value: string) => applyChanges({ [key]: value === "all" ? null : value }), [applyChanges]);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? searchParams.get("frota") ?? searchParams.get("placa") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const current = searchParams.get("q") ?? searchParams.get("frota") ?? searchParams.get("placa") ?? "";
    if (query === current) return;
    // Busca nova escreve só q — limpa frota/placa legados pra não somarem com o novo filtro.
    const handle = window.setTimeout(
      () => applyChanges({ q: query.trim() || null, frota: null, placa: null }),
      350
    );
    return () => window.clearTimeout(handle);
  }, [query, searchParams, applyChanges]);

  const cdAtual = searchParams.get("cd") ?? "";
  const modelo = searchParams.get("modelo") ?? "";
  const localizacao = searchParams.get("localizacao") ?? "";
  const operacional = searchParams.get("operacional") ?? "";
  const condicao = searchParams.get("condicao") ?? "";
  const cadastroIncompleto = searchParams.get("cadastro") === "incompleto";
  const semKm = searchParams.get("semKm") === "1";

  const activeChips: { key: string; label: string; clear: Patch }[] = [
    ...(modelo ? [{ key: "modelo", label: `Modelo: ${modelo}`, clear: { modelo: null } }] : []),
    ...(localizacao ? [{ key: "localizacao", label: `Local: ${localizacao}`, clear: { localizacao: null } }] : []),
    ...(operacional
      ? [{
          key: "operacional",
          label: OPERACIONAIS.find((o) => o.value === operacional)?.label ?? operacional,
          clear: { operacional: null },
        }]
      : []),
    ...(condicao
      ? [{
          key: "condicao",
          label: CONDICOES.find((c) => c.value === condicao)?.label ?? condicao,
          clear: { condicao: null },
        }]
      : []),
    ...(cadastroIncompleto ? [{ key: "cadastro", label: "Cadastro incompleto", clear: { cadastro: null } }] : []),
    ...(semKm ? [{ key: "semKm", label: "Sem KM", clear: { semKm: null } }] : []),
  ];

  const advancedActiveCount = activeChips.length;
  const hasAnyFilter = Boolean(query || cdAtual) || advancedActiveCount > 0;

  function clearAll() {
    setQuery("");
    startTransition(() => router.replace(basePath, { scroll: false }));
  }

  return (
    <div className="space-y-2">
      <FilterBar>
        <FilterSearch
          value={query}
          onChange={setQuery}
          placeholder="Frota, placa, chassi ou modelo…"
        />

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="h-11 gap-1.5 sm:h-9">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filtros
              {advancedActiveCount > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1 tabular-nums">
                  {advancedActiveCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filtros avançados</SheetTitle>
              <SheetDescription>Refine a lista por modelo, localização, status, condição ou cadastro.</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Modelo</label>
                <Select value={modelo || "all"} onValueChange={(v) => update("modelo", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos modelos</SelectItem>
                    {modelos.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Localização</label>
                <Select value={localizacao || "all"} onValueChange={(v) => applyChanges({ localizacao: v === "all" ? null : v, cd: null })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Localização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas localizações</SelectItem>
                    {localizacoes.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Status operacional</label>
                <Select value={operacional || "all"} onValueChange={(v) => update("operacional", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    {OPERACIONAIS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Condição</label>
                <Select value={condicao || "all"} onValueChange={(v) => update("condicao", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Condição" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas condições</SelectItem>
                    {CONDICOES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Cadastro</label>
                <Select
                  value={cadastroIncompleto ? "incompleto" : semKm ? "semKm" : "all"}
                  onValueChange={(v) => {
                    if (v === "semKm") applyChanges({ semKm: "1", cadastro: null });
                    else applyChanges({ semKm: null, cadastro: v === "all" ? null : v });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Cadastro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos cadastros</SelectItem>
                    <SelectItem value="incompleto">Incompletos</SelectItem>
                    <SelectItem value="semKm">Sem KM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <SheetClose asChild>
                <Button type="button" className="flex-1">
                  Aplicar
                </Button>
              </SheetClose>
              {advancedActiveCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => applyChanges({ modelo: null, localizacao: null, operacional: null, condicao: null, cadastro: null, semKm: null })}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {hasAnyFilter && (
          <Button type="button" variant="ghost" onClick={clearAll} className="h-11 gap-1.5 sm:h-9">
            <X className="h-4 w-4" aria-hidden="true" />
            Limpar
          </Button>
        )}

        <span aria-live="polite" className="text-xs text-muted-foreground sm:ml-auto">
          {isPending ? "Atualizando veículos…" : null}
        </span>
      </FilterBar>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip label="Todos os CDs" active={!cdAtual} onClick={() => applyChanges({ cd: null, localizacao: null })} />
        {cds.map((cd) => (
          <FilterChip key={cd} label={cd} active={cdAtual === cd} onClick={() => applyChanges({ cd, localizacao: null })} />
        ))}
        {activeChips.map((chip) => (
          <FilterChip
            key={chip.key}
            label={
              <span className="inline-flex items-center gap-1">
                {chip.label}
                <X className="h-3 w-3" aria-hidden="true" />
              </span>
            }
            active
            onClick={() => applyChanges(chip.clear)}
          />
        ))}
      </div>
    </div>
  );
}
