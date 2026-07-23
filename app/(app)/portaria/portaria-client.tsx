"use client";

import { useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, LogIn, LogOut, ChevronRight,
  Layers,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FilterBar, FilterSearch, FilterChip } from "@/components/ui/filter-bar";
import { cn, formatNumber } from "@/lib/utils";
import type { SeverityKey } from "@/lib/design/tokens";
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

const FILTER_TABS: {
  label: string;
  value: StatusPortaria | "BLOQUEADAS" | "TODAS";
  icon: ComponentType<LucideProps>;
  severity?: SeverityKey;
}[] = [
  { label: "Todas", value: "TODAS", icon: Layers },
  { label: "Aguardando", value: "LIBERADA_SAIDA", icon: LogOut, severity: "OK" },
  { label: "Pendentes", value: "PENDENTE_CHECKLIST", icon: Clock, severity: "ATENCAO" },
  { label: "Bloqueadas", value: "BLOQUEADAS", icon: AlertTriangle, severity: "CRITICO" },
  { label: "Saídas", value: "SAIDA_REGISTRADA", icon: LogIn, severity: "INFO" },
];

type Props = { rows: PortariaRow[]; erro?: string | null; canApproveExit: boolean };

function isBloqueada(status: StatusPortaria): boolean {
  return status === "BLOQUEADA_CHECKLIST" || status === "BLOQUEADA_MANUTENCAO";
}

export function PortariaClient({ rows, erro, canApproveExit }: Props) {
  const [queryFrota, setQueryFrota] = useState("");
  const [queryPlaca, setQueryPlaca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusPortaria | "BLOQUEADAS" | "TODAS">("LIBERADA_SAIDA");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<PortariaRow | null>(null);
  const [detalhe, setDetalhe] = useState<ChecklistDetalhePortaria | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const detailRequestRef = useRef(0);

  const filtered = rows.filter((r) => {
    const frota = queryFrota.trim().toLowerCase();
    const placa = queryPlaca.trim().toLowerCase();
    if (frota && !String(r.frota_geral ?? "").toLowerCase().includes(frota)) return false;
    if (placa && !String(r.placa ?? "").toLowerCase().includes(placa)) return false;
    if (filtroStatus === "BLOQUEADAS" && !isBloqueada(r.status_portaria)) return false;
    if (filtroStatus !== "TODAS" && filtroStatus !== "BLOQUEADAS" && r.status_portaria !== filtroStatus) return false;
    return true;
  });

  async function handleRowClick(row: PortariaRow) {
    const requestId = ++detailRequestRef.current;
    setSelectedRow(row);
    setSheetOpen(true);
    setDetalhe(null);
    setLoadingDetalhe(Boolean(row.checklist_id));
    if (row.checklist_id) {
      try {
        const res = await fetch(
          `/api/portaria/detalhe?checklist_id=${row.checklist_id}&frota_id=${row.frota_id}`,
          { cache: "no-store" }
        );
        const data: ChecklistDetalhePortaria | null = res.ok ? await res.json() : null;
        if (detailRequestRef.current === requestId) setDetalhe(data);
      } catch {
        if (detailRequestRef.current === requestId) setDetalhe(null);
      } finally {
        if (detailRequestRef.current === requestId) setLoadingDetalhe(false);
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

      <FilterBar sticky>
        <FilterSearch
          value={queryFrota}
          onChange={setQueryFrota}
          placeholder="Nº frota…"
        />
        <FilterSearch
          value={queryPlaca}
          onChange={setQueryPlaca}
          placeholder="Placa…"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.value === "TODAS"
                ? rows.length
                : tab.value === "BLOQUEADAS"
                  ? rows.filter((r) => isBloqueada(r.status_portaria)).length
                : rows.filter((r) => r.status_portaria === tab.value).length;
            return (
              <FilterChip
                key={tab.value}
                label={tab.label}
                icon={tab.icon}
                count={count}
                active={filtroStatus === tab.value}
                severity={filtroStatus === tab.value ? tab.severity : undefined}
                onClick={() => setFiltroStatus(tab.value)}
              />
            );
          })}
        </div>
      </FilterBar>

      {/* Lista de veículos */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">
            {queryFrota || queryPlaca
              ? `Nenhuma frota encontrada para os filtros aplicados.`
              : "Nenhuma frota aguardando ação no momento."}
          </div>
        )}
        {filtered.map((row) => (
          <button
            key={row.frota_id}
            type="button"
            onClick={() => handleRowClick(row)}
            className={cn(
              "group relative w-full overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 text-left transition-all duration-150",
              "shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)]",
              "hover:-translate-y-[1px] hover:border-blue-300 hover:shadow-[0_2px_0_rgba(15,23,42,0.04),0_16px_32px_-12px_rgba(15,23,42,0.22)]",
              row.status_portaria === "BLOQUEADA_CHECKLIST" && "border-l-4 border-l-red-500",
              row.status_portaria === "BLOQUEADA_MANUTENCAO" && "border-l-4 border-l-violet-500",
              row.status_portaria === "LIBERADA_SAIDA" && "border-l-4 border-l-emerald-500",
              row.status_portaria === "SAIDA_REGISTRADA" && "border-l-4 border-l-blue-500",
              row.status_portaria === "PENDENTE_CHECKLIST" && "border-l-4 border-l-amber-500"
            )}
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
        canApproveExit={canApproveExit}
      />
    </>
  );
}
