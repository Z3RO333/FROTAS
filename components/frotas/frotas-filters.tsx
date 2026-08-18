"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  modelos: string[];
  localizacoes: string[];
  cds: string[];
  basePath?: string;
};

const OPERACIONAIS = [
  { value: "all", label: "Todos status" },
  { value: "disponivel", label: "Disponível" },
  { value: "manutencao", label: "Em manutenção" },
  { value: "indisponivel", label: "Indisponível" },
];

const CONDICOES = [
  { value: "all", label: "Todas condições" },
  { value: "normal", label: "Normal" },
  { value: "atencao", label: "Atenção" },
  { value: "critico", label: "Crítico" },
];

export function FrotasFilters({ modelos, localizacoes, cds, basePath = "/frotas" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [buscaFrota, setBuscaFrota] = useState(searchParams.get("frota") ?? "");
  const [buscaPlaca, setBuscaPlaca] = useState(searchParams.get("placa") ?? "");
  const [, startTransition] = useTransition();

  const applyChanges = useCallback((changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    });
  }, [basePath, router, searchParams]);

  const update = useCallback((key: string, value: string) => {
    applyChanges({ [key]: value });
  }, [applyChanges]);

  useEffect(() => {
    setBuscaFrota(searchParams.get("frota") ?? "");
    setBuscaPlaca(searchParams.get("placa") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const current = searchParams.get("frota") ?? "";
    if (buscaFrota === current) return;

    const handle = window.setTimeout(() => update("frota", buscaFrota.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [buscaFrota, searchParams, update]);

  useEffect(() => {
    const current = searchParams.get("placa") ?? "";
    if (buscaPlaca === current) return;

    const handle = window.setTimeout(() => update("placa", buscaPlaca.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [buscaPlaca, searchParams, update]);

  const cdAtual = searchParams.get("cd") ?? "all";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => applyChanges({ cd: "", localizacao: "" })}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            cdAtual === "all" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Todos os CDs
        </button>
        {cds.map((cd) => (
          <button
            key={cd}
            type="button"
            onClick={() => applyChanges({ cd, localizacao: "" })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              cdAtual === cd ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {cd}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-white p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(140px,.7fr)_minmax(160px,.9fr)_repeat(5,minmax(150px,.8fr))_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={buscaFrota}
              onChange={(event) => setBuscaFrota(event.target.value)}
              placeholder="Buscar por frota..."
              className="pl-9"
            />
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={buscaPlaca}
              onChange={(event) => setBuscaPlaca(event.target.value)}
              placeholder="Buscar por placa ou chassi..."
              className="pl-9"
            />
          </div>

          <Select value={searchParams.get("modelo") ?? "all"} onValueChange={(v) => update("modelo", v)}>
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

          <Select
            value={searchParams.get("localizacao") ?? "all"}
            onValueChange={(v) => applyChanges({ localizacao: v, cd: "" })}
          >
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

          <Select
            value={searchParams.get("operacional") ?? "all"}
            onValueChange={(v) => update("operacional", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {OPERACIONAIS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={searchParams.get("condicao") ?? "all"} onValueChange={(v) => update("condicao", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Condição" />
            </SelectTrigger>
            <SelectContent>
              {CONDICOES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={searchParams.get("cadastro") ?? (searchParams.get("semKm") ? "semKm" : "all")}
            onValueChange={(v) => {
              if (v === "semKm") applyChanges({ semKm: "1", cadastro: "" });
              else applyChanges({ semKm: "", cadastro: v });
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

          <Button
            variant="ghost"
            onClick={() => startTransition(() => router.replace(basePath, { scroll: false }))}
            className="justify-center gap-2"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Limpar
          </Button>
        </div>
      </div>
    </div>
  );
}
