"use client";

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

type Props = { modelos: string[]; localizacoes: string[] };

const STATUSES = [
  { value: "all", label: "Todos os status" },
  { value: "disponivel", label: "Disponivel" },
  { value: "manutencao", label: "Manutencao" },
  { value: "atencao", label: "Atencao" },
  { value: "critico", label: "Critico" },
];

export function FrotasFilters({ modelos, localizacoes }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `/frotas?${qs}` : "/frotas");
  }

  function submitSearch(formData: FormData) {
    update("search", String(formData.get("search") ?? "").trim());
  }

  return (
    <div className="flex flex-wrap gap-3">
      <form action={submitSearch} className="flex min-w-64 flex-1 gap-2 sm:max-w-sm">
        <Input
          name="search"
          placeholder="Buscar placa, chassi, modelo..."
          defaultValue={searchParams.get("search") ?? ""}
        />
        <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
      <Select value={searchParams.get("modelo") ?? "all"} onValueChange={(v) => update("modelo", v)}>
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Modelo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os modelos</SelectItem>
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
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Localizacao" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas localizacoes</SelectItem>
          {localizacoes.map((l) => (
            <SelectItem key={l} value={l}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("status") ?? "all"} onValueChange={(v) => update("status", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" onClick={() => router.push("/frotas")} className="gap-2">
        <X className="h-4 w-4" aria-hidden="true" />
        Limpar
      </Button>
    </div>
  );
}
