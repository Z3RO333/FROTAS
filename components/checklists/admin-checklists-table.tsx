"use client";

import { Fragment, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronRight, Clock,
  Gauge, MessageSquare, User, XCircle, ClipboardCheck, ArrowRight,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type { ChecklistDetalhePortaria } from "@/lib/repos/portaria-detail";
import type { ChecklistListRow } from "@/lib/repos/checklists";

type Group = { date: string; items: ChecklistListRow[] };

export function AdminChecklistsTable({ groups }: { groups: Group[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detalhe, setDetalhe] = useState<ChecklistDetalhePortaria | null>(null);

  async function handleClick(checklistId: number, frotaId: number) {
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

  const itensProblema = detalhe?.itens.filter((i) => i.status === "NAO_APTO") ?? [];
  const itensOk = detalhe?.itens.filter((i) => i.status === "APTO") ?? [];
  const fotoHodometro = detalhe?.fotos.find((f) => f.source_type === "hodometro");

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[940px] text-sm">
          <thead className="border-b bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-24 px-4 py-3">Horário</th>
              <th className="px-4 py-3">Frota / placa</th>
              <th className="px-4 py-3">Setor</th>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3 text-right">KM</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Observações</th>
              <th className="w-12 px-3 py-3"><span className="sr-only">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.date}>
                <tr className="border-t bg-slate-100">
                  <td colSpan={8} className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                    {group.date} · {group.items.length} {group.items.length === 1 ? "checklist" : "checklists"}
                  </td>
                </tr>
                {group.items.map((checklist) => {
                  const observacao =
                    checklist.observacao_corrigida_ia?.trim() || checklist.observacao_original?.trim() || "";
                  return (
                    <tr
                      key={checklist.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Abrir checklist da frota ${checklist.frota_geral ?? checklist.placa ?? checklist.frota_id}`}
                      className={cn(
                        "group cursor-pointer border-t align-middle transition-colors hover:bg-blue-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
                        checklist.status_geral === "CRITICO" || checklist.status_geral === "NAO_APTO"
                          ? "bg-red-50/35"
                          : checklist.status_geral === "COM_OBSERVACAO"
                            ? "bg-amber-50/30"
                            : "bg-white"
                      )}
                      onClick={() => handleClick(checklist.id, checklist.frota_id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleClick(checklist.id, checklist.frota_id);
                        }
                      }}
                    >
                      <td className={cn(
                        "whitespace-nowrap border-l-4 px-4 py-3 font-medium tabular-nums text-slate-600",
                        checklist.status_geral === "APROVADO"
                          ? "border-l-emerald-400"
                          : checklist.status_geral === "COM_OBSERVACAO"
                            ? "border-l-amber-400"
                            : "border-l-red-500"
                      )}>
                        {formatTime(checklist.data_checklist)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-950">Frota {checklist.frota_geral ?? checklist.frota_id}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{checklist.placa ?? "Sem placa"}</p>
                      </td>
                      <td className="max-w-48 px-4 py-3 text-slate-600">
                        <p className="line-clamp-2" title={checklist.rota ?? undefined}>{checklist.rota ?? "—"}</p>
                      </td>
                      <td className="max-w-52 px-4 py-3"><p className="line-clamp-2">{checklist.motorista_nome ?? checklist.motorista_id}</p></td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-700">{formatNumber(checklist.km_informado)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={checklist.status_geral} size="sm" />
                      </td>
                      <td className="min-w-56 max-w-80 px-4 py-3 text-xs leading-5 text-slate-600">
                        <p className="line-clamp-2" title={observacao || undefined}>{observacao || "Sem observações"}</p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" aria-hidden="true" />
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum checklist encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="space-y-4 p-3 pt-0 md:hidden">
        {groups.map((group) => (
          <div key={group.date} className="space-y-3">
            <div className="sticky top-0 z-10 -mx-3 bg-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {group.date} · {group.items.length} {group.items.length === 1 ? "checklist" : "checklists"}
            </div>
            {group.items.map((checklist) => {
              const observacao =
                checklist.observacao_corrigida_ia?.trim() || checklist.observacao_original?.trim() || "";
              return (
                <button
                  key={checklist.id}
                  type="button"
                  onClick={() => handleClick(checklist.id, checklist.frota_id)}
                  className={cn(
                    "w-full rounded-xl border border-l-4 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    checklist.status_geral === "APROVADO"
                      ? "border-l-emerald-400"
                      : checklist.status_geral === "COM_OBSERVACAO"
                        ? "border-l-amber-400"
                        : "border-l-red-500"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{formatDate(checklist.data_checklist)}</p>
                      <h2 className="mt-0.5 truncate text-lg font-semibold">
                        Frota {checklist.frota_geral ?? checklist.placa ?? checklist.frota_id}
                      </h2>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={checklist.status_geral} size="sm" />
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">{checklist.placa ?? "-"}</span>
                    <span className="text-muted-foreground">KM {formatNumber(checklist.km_informado)}</span>
                    <span className="col-span-2 truncate text-muted-foreground">{checklist.motorista_nome ?? checklist.motorista_id}</span>
                  </div>
                  {observacao ? (
                    <p className="mt-2 border-t pt-2 text-sm text-slate-700">{observacao}</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
        {groups.length === 0 && (
          <div className="rounded-xl border border-dashed bg-slate-50 p-6 text-center text-sm text-muted-foreground">
            Nenhum checklist encontrado para os filtros selecionados.
          </div>
        )}
      </div>

      {/* Sheet de detalhe */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col overflow-y-auto bg-white sm:max-w-xl">
          <SheetHeader className="border-b px-5 pb-4 pt-5 pr-16">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-blue-600" />
              {detalhe
                ? `Checklist · Frota ${detalhe.frota_geral ?? detalhe.frota_id} · ${formatDate(detalhe.criado_em)}`
                : "Carregando..."}
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
            <div className="space-y-5 px-5 py-5 pb-8">
              <div className="grid grid-cols-2 gap-3 rounded-xl border bg-slate-50 p-4">
                <div>
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <User className="h-3 w-3" /> Motorista
                  </p>
                  <p className="mt-0.5 text-sm font-medium">{detalhe.motorista_nome ?? detalhe.motorista_id}</p>
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

              {fotoHodometro?.signed_url && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Foto do painel / hodômetro
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fotoHodometro.signed_url}
                    alt="Foto do painel"
                    className="h-auto w-full rounded-lg border bg-slate-50 object-contain"
                    loading="lazy"
                  />
                </div>
              )}

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

              {itensProblema.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-red-600">
                    <AlertTriangle className="h-3 w-3" /> Itens não conforme ({itensProblema.length})
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

              {itensOk.length > 0 && (
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-slate-700">
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    Itens aprovados ({itensOk.length})
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

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
