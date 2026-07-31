"use client";

import { useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronRight, Clock,
  Gauge, MessageSquare, User, XCircle, ClipboardCheck,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type { ChecklistDetalhePortaria } from "@/lib/repos/portaria-detail";

type ChecklistRow = {
  id: number;
  data_checklist: string | null;
  motorista_nome: string | null;
  motorista_id: string;
  km_informado: number | null;
  status_geral: string;
};

type Props = {
  rows: ChecklistRow[];
  frotaId: number;
};

export function ChecklistsListClient({ rows, frotaId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detalhe, setDetalhe] = useState<ChecklistDetalhePortaria | null>(null);

  async function handleClick(checklistId: number) {
    setOpen(true);
    setDetalhe(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/portaria/detalhe?checklist_id=${checklistId}&frota_id=${frotaId}`,
        { cache: "no-store" }
      );
      const data: ChecklistDetalhePortaria | null = res.ok ? await res.json() : null;
      setDetalhe(data);
    } catch {
      setDetalhe(null);
    } finally {
      setLoading(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
        <ClipboardCheck className="h-8 w-8 opacity-30" />
        Sem checklists registrados
      </div>
    );
  }

  const itensProblema = detalhe?.itens.filter((i) => i.status === "NAO_APTO") ?? [];
  const itensOk = detalhe?.itens.filter((i) => i.status === "APTO") ?? [];
  const fotoHodometro = detalhe?.fotos.find((f) => f.source_type === "hodometro");

  return (
    <>
      <div className="divide-y">
        {rows.map((checklist) => (
          <button
            key={checklist.id}
            type="button"
            onClick={() => handleClick(checklist.id)}
            className="group w-full p-4 text-left transition-colors hover:bg-slate-50"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-slate-950">
                {formatDate(checklist.data_checklist)}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={checklist.status_geral} />
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {checklist.motorista_nome ?? checklist.motorista_id} · KM{" "}
              {formatNumber(checklist.km_informado)}
            </div>
          </button>
        ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-blue-600" />
              Checklist — {detalhe ? formatDate(detalhe.criado_em) : "..."}
            </SheetTitle>
          </SheetHeader>

          {loading && (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          )}

          {!loading && !detalhe && (
            <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Não foi possível carregar o checklist.
            </p>
          )}

          {!loading && detalhe && (
            <div className="space-y-5 pb-6">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-3 rounded-xl border bg-slate-50 p-4">
                <div>
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <User className="h-3 w-3" /> Motorista
                  </p>
                  <p className="mt-0.5 text-sm font-medium">
                    {detalhe.motorista_nome ?? detalhe.motorista_id}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Gauge className="h-3 w-3" /> KM informado
                  </p>
                  <p className="mt-0.5 text-sm font-medium">{formatNumber(detalhe.km_informado)}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Clock className="h-3 w-3" /> Horário
                  </p>
                  <p className="mt-0.5 text-sm font-medium">
                    {detalhe.criado_em
                      ? new Date(detalhe.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={detalhe.status_geral ?? ""} />
                  </div>
                </div>
              </div>

              {/* Foto do hodômetro */}
              {fotoHodometro?.signed_url && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Foto do painel / hodômetro
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fotoHodometro.signed_url}
                    alt="Foto completa do painel e hodômetro"
                    className="h-auto w-full rounded-lg border bg-slate-50 object-contain"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Observações */}
              {(detalhe.observacao_corrigida_ia ?? detalhe.observacao_original) && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <MessageSquare className="h-3 w-3" /> Observações
                  </p>
                  <p className="rounded-lg border bg-slate-50 p-3 text-sm">
                    {detalhe.observacao_corrigida_ia ?? detalhe.observacao_original}
                  </p>
                </div>
              )}

              {/* Itens com problema */}
              {itensProblema.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-red-600">
                    <AlertTriangle className="h-3 w-3" /> Itens inconforme ({itensProblema.length})
                  </p>
                  {itensProblema.map((item) => {
                    const foto = detalhe.fotos.find((f) => f.checklist_item_codigo === item.item_codigo);
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-lg border p-3",
                          item.obrigatorio ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">
                              {item.item_nome}
                              {item.obrigatorio && (
                                <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">OBR</span>
                              )}
                              {item.critico && (
                                <span className="ml-1 rounded-full bg-red-800 px-1.5 py-0.5 text-[9px] font-bold text-white">CRÍTICO</span>
                              )}
                            </p>
                            {item.observacao && (
                              <p className="mt-0.5 text-xs text-muted-foreground">{item.observacao}</p>
                            )}
                          </div>
                          <XCircle className={cn("mt-0.5 h-4 w-4 shrink-0", item.obrigatorio ? "text-red-500" : "text-amber-500")} />
                        </div>
                        {foto?.signed_url && (
                          <div className="mt-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={foto.signed_url} alt={item.item_nome} className="max-h-28 w-full rounded-md object-cover" loading="lazy" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Todos os itens (colapsável) */}
              {detalhe.itens.length > 0 && (
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-slate-700">
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    {itensOk.length > 0 ? `Itens aprovados (${itensOk.length})` : "Todos os itens"}
                  </summary>
                  <div className="mt-2 space-y-0.5">
                    {itensOk.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 rounded-md px-2 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span className="text-sm">{item.item_nome}</span>
                        {!item.obrigatorio && (
                          <span className="text-[10px] text-muted-foreground">(opcional)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
