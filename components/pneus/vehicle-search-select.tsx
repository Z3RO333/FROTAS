"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { Veiculo } from "@/lib/repos/manutencao/types";
import { cn } from "@/lib/utils";

function normalizeSearch(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function vehicleLabel(vehicle: Veiculo): string {
  return `${vehicle.codigo_frota} · ${vehicle.placa ?? "Sem placa"} · ${vehicle.modelo ?? "Sem modelo"}`;
}

export function VehicleSearchSelect({
  veiculos,
  selectedId,
  onSelect,
}: {
  veiculos: Veiculo[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = veiculos.find((veiculo) => String(veiculo.id) === selectedId) ?? null;

  const filtered = useMemo(() => {
    const term = normalizeSearch(query);
    if (!term) return veiculos;
    return veiculos.filter((veiculo) =>
      [veiculo.codigo_frota, veiculo.placa, veiculo.modelo]
        .some((value) => normalizeSearch(value).includes(term))
    );
  }, [query, veiculos]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  function selectVehicle(vehicle: Veiculo) {
    onSelect(String(vehicle.id));
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        id="veiculo"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 py-2 text-left text-sm transition-colors hover:border-blue-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      >
        <span className={cn("min-w-0 truncate", !selected && "text-slate-400")}>
          {selected ? vehicleLabel(selected) : "Selecione uma frota"}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                role="combobox"
                aria-controls="vehicle-search-results"
                aria-expanded="true"
                aria-autocomplete="list"
                placeholder="Pesquisar por frota, placa ou modelo"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((current) => Math.max(current - 1, 0));
                  } else if (event.key === "Enter" && filtered[activeIndex]) {
                    event.preventDefault();
                    selectVehicle(filtered[activeIndex]);
                  } else if (event.key === "Escape") {
                    setOpen(false);
                    triggerRef.current?.focus();
                  }
                }}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Limpar pesquisa"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div id="vehicle-search-results" role="listbox" className="max-h-72 overflow-y-auto p-1">
            {filtered.map((veiculo, index) => {
              const isSelected = String(veiculo.id) === selectedId;
              return (
                <button
                  key={veiculo.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectVehicle(veiculo)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    index === activeIndex ? "bg-blue-50 text-blue-950" : "hover:bg-slate-50",
                    isSelected && "font-medium"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">Frota {veiculo.codigo_frota}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {veiculo.placa ?? "Sem placa"} · {veiculo.modelo ?? "Sem modelo"}
                    </span>
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Nenhuma frota ou placa encontrada.
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {filtered.length} {filtered.length === 1 ? "frota encontrada" : "frotas encontradas"}
          </div>
        </div>
      )}
    </div>
  );
}
