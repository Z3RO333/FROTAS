"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
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

export function ChecklistFilters({ basePath = "/checklists" }: { basePath?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

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
  const temFiltro = Boolean(periodo || dataInicio || dataFim);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-white p-3 shadow-sm">
      <Select
        value={periodo || "all"}
        onValueChange={(v) => applyChanges({ periodo: v === "all" ? "" : v, dataInicio: "", dataFim: "" })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Período" />
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

      <span className="text-sm text-muted-foreground">ou intervalo:</span>

      <Input
        type="date"
        value={dataInicio}
        onChange={(e) => applyChanges({ dataInicio: e.target.value, periodo: "" })}
        className="w-[160px]"
        aria-label="Data início"
      />
      <span className="text-sm text-muted-foreground">até</span>
      <Input
        type="date"
        value={dataFim}
        onChange={(e) => applyChanges({ dataFim: e.target.value, periodo: "" })}
        className="w-[160px]"
        aria-label="Data fim"
      />

      {temFiltro ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => startTransition(() => router.replace(basePath, { scroll: false }))}
          className="gap-1.5"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Limpar
        </Button>
      ) : null}
    </div>
  );
}
