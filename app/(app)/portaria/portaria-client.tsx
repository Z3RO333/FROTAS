"use client";

import { useState } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, LogIn, LogOut, Search, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, formatNumber } from "@/lib/utils";
import { VeiculoSheet } from "./veiculo-sheet";
import type { PortariaRow, StatusPortaria } from "@/lib/repos/checklists";
import type { ChecklistDetalhePortaria } from "@/lib/repos/portaria-detail";

const STATUS_CLASS: Record<StatusPortaria, string> = {
  PENDENTE_CHECKLIST: "border-slate-200 bg-slate-50 text-slate-700",
  CHECKLIST_REALIZADO: "border-amber-200 bg-amber-50 text-amber-800",
  LIBERADA_SAIDA: "border-emerald-200 bg-emerald-50 text-emerald-800",
  BLOQUEADA_CHECKLIST: "border-red-200 bg-red-50 text-red-800",
  BLOQUEADA_MANUTENCAO: "border-violet-200 bg-violet-50 text-violet-800",
  SAIDA_REGISTRADA: "border-blue-200 bg-blue-50 text-blue-800",
  ENTRADA_REGISTRADA: "border-slate-200 bg-slate-100 text-slate-700",
};

const STATUS_LABELS: Record<StatusPortaria, string> = {
  PENDENTE_CHECKLIST: "Pendente checklist",
  CHECKLIST_REALIZADO: "Com observação",
  LIBERADA_SAIDA: "Liberada",
  BLOQUEADA_CHECKLIST: "Bloqueada",
  BLOQUEADA_MANUTENCAO: "Em manutenção",
  SAIDA_REGISTRADA: "Saída registrada",
  ENTRADA_REGISTRADA: "Entrada registrada",
};

const FILTER_TABS: { label: string; value: StatusPortaria | "TODAS" }[] = [
  { label: "Todas", value: "TODAS" },
  { label: "Aguardando", value: "LIBERADA_SAIDA" },
  { label: "Pendentes", value: "PENDENTE_CHECKLIST" },
  { label: "Bloqueadas", value: "BLOQUEADA_CHECKLIST" },
  { label: "Saídas", value: "SAIDA_REGISTRADA" },
];

type Props = { rows: PortariaRow[]; erro?: string | null };

export function PortariaClient({ rows, erro }: Props) {
  const [query, setQuery] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusPortaria | "TODAS">("TODAS");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<PortariaRow | null>(null);
  const [detalhe, setDetalhe] = useState<ChecklistDetalhePortaria | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (q) {
      const match = [r.frota_geral, r.placa, r.modelo, r.motorista_nome]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filtroStatus !== "TODAS" && r.status_portaria !== filtroStatus) return false;
    return true;
  });

  async function handleRowClick(row: PortariaRow) {
    setSelectedRow(row);
    setSheetOpen(true);
    setDetalhe(null);
    if (row.checklist_id) {
      setLoadingDetalhe(true);
      try {
        const res = await fetch(
          `/api/portaria/detalhe?checklist_id=${row.checklist_id}&frota_id=${row.frota_id}`,
          { cache: "no-store" }
        );
        const data: ChecklistDetalhePortaria | null = res.ok ? await res.json() : null;
        setDetalhe(data);
      } catch {
        setDetalhe(null);
      } finally {
        setLoadingDetalhe(false);
      }
    }
  }

  return (
    <>
      {erro && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {erro}
        </div>
      )}

      {/* Pesquisa */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar frota, placa ou motorista..."
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {/* Tabs de filtro compactas */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFiltroStatus(tab.value)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filtroStatus === tab.value
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {tab.label}
            {tab.value !== "TODAS" && (
              <span className="ml-1 opacity-70">
                ({rows.filter((r) => r.status_portaria === tab.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista de veículos */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">
            {query
              ? `Nenhuma frota encontrada para "${query}". Tente pesquisar pela placa ou número da frota.`
              : "Nenhuma frota aguardando ação no momento."}
          </div>
        )}
        {filtered.map((row) => (
          <button
            key={row.frota_id}
            type="button"
            onClick={() => handleRowClick(row)}
            className="group w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{row.frota_geral ?? `#${row.frota_id}`}</span>
                  {row.placa && <span className="font-mono text-sm text-muted-foreground">{row.placa}</span>}
                  <Badge variant="outline" className={cn("text-xs", STATUS_CLASS[row.status_portaria])}>
                    {STATUS_LABELS[row.status_portaria]}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {row.motorista_nome && <span>{row.motorista_nome}</span>}
                  {row.data_checklist && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(row.data_checklist).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {row.km_informado != null && (
                    <span>{formatNumber(row.km_informado)} km</span>
                  )}
                </div>
                {row.pendencia_critica_item && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    {row.pendencia_critica_item}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {row.status_portaria === "LIBERADA_SAIDA" && (
                  <span className="rounded-full bg-emerald-100 p-1.5 text-emerald-700">
                    <LogOut className="h-4 w-4" />
                  </span>
                )}
                {row.status_portaria === "SAIDA_REGISTRADA" && (
                  <span className="rounded-full bg-blue-100 p-1.5 text-blue-700">
                    <LogIn className="h-4 w-4" />
                  </span>
                )}
                {row.status_portaria === "BLOQUEADA_CHECKLIST" && (
                  <span className="rounded-full bg-red-100 p-1.5 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                )}
                {row.status_portaria === "PENDENTE_CHECKLIST" && (
                  <span className="rounded-full bg-slate-100 p-1.5 text-slate-500">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </button>
        ))}
      </div>

      <VeiculoSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        detalhe={detalhe}
        loading={loadingDetalhe}
        statusPortaria={selectedRow?.status_portaria ?? null}
      />
    </>
  );
}
