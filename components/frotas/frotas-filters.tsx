"use client";

import { useEffect, useState } from "react";
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

type Props = { modelos: string[]; localizacoes: string[]; basePath?: string };

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

export function FrotasFilters({ modelos, localizacoes, basePath = "/frotas" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  function applyChanges(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  function update(key: string, value: string) {
    applyChanges({ [key]: value });
  }

  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (search === current) return;

    const handle = window.setTimeout(() => update("search", search.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [search, searchParams]);

  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.2fr)_repeat(5,minmax(150px,.8fr))_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar placa, chassi, modelo, localização..."
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
          onValueChange={(v) => update("localizacao", v)}
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

        <Button variant="ghost" onClick={() => router.push(basePath)} className="justify-center gap-2">
          <X className="h-4 w-4" aria-hidden="true" />
          Limpar
        </Button>
      </div>
    </div>
  );
}
