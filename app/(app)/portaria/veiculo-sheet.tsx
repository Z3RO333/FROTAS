"use client";

import { useState } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Gauge, LogIn, LogOut,
  Lock, MessageSquare, RefreshCw, Truck, User, ChevronRight, XCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn, formatNumber } from "@/lib/utils";
import {
  registrarMovimentacaoPortariaAction,
  bloquearSaidaAction,
  solicitarCorrecaoAction,
} from "./portaria-actions-client";
import type { ChecklistDetalhePortaria } from "@/lib/repos/portaria-detail";
import type { StatusPortaria } from "@/lib/repos/checklists";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detalhe: ChecklistDetalhePortaria | null;
  loading: boolean;
  statusPortaria: StatusPortaria | null;
};

const STATUS_GERAL_CLASS: Record<string, string> = {
  APROVADO: "border-emerald-200 bg-emerald-50 text-emerald-800",
  COM_OBSERVACAO: "border-amber-200 bg-amber-50 text-amber-800",
  NAO_APTO: "border-red-200 bg-red-50 text-red-800",
  CRITICO: "border-red-300 bg-red-100 text-red-900",
};

function FotoPreview({ url, label }: { url: string | null; label: string }) {
  if (!url) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="max-h-40 w-full rounded-lg border object-cover" loading="lazy" />
    </div>
  );
}

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

export function VeiculoSheet({ open, onOpenChange, detalhe, loading, statusPortaria }: Props) {
  const [showBloqueioForm, setShowBloqueioForm] = useState(false);
  const [showCorrecaoForm, setShowCorrecaoForm] = useState(false);

  const canLiberar = statusPortaria === "LIBERADA_SAIDA";
  const canEntrada = statusPortaria === "SAIDA_REGISTRADA";
  const canBloquear = statusPortaria === "LIBERADA_SAIDA" || statusPortaria === "CHECKLIST_REALIZADO";
  const canCorrecao = statusPortaria === "CHECKLIST_REALIZADO" || statusPortaria === "BLOQUEADA_CHECKLIST";

  const itensProblema = detalhe?.itens.filter((i) => i.status === "NAO_APTO") ?? [];
  const itensCriticos = itensProblema.filter((i) => i.critico);
  const fotoHodometro = detalhe?.fotos.find((f) => f.source_type === "hodometro");

  const titulo = detalhe
    ? `${detalhe.frota_geral ?? `#${detalhe.frota_id}`} · ${detalhe.placa ?? "—"}`
    : "Carregando...";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            {titulo}
          </SheetTitle>
        </SheetHeader>

        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        )}

        {!loading && !detalhe && (
          <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Sem checklist de hoje para este veículo.
          </p>
        )}

        {!loading && detalhe && (
          <div className="space-y-5 pb-8">
            {/* Status geral + alertas */}
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className={cn("text-sm", STATUS_GERAL_CLASS[detalhe.status_geral ?? ""] ?? "")}>
                {detalhe.status_geral ?? "—"}
              </Badge>
              {itensCriticos.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                  <XCircle className="h-3.5 w-3.5" />
                  {itensCriticos.length} item(s) crítico(s)
                </span>
              )}
            </div>

            {/* Dados do veículo / motorista */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-slate-50 p-4">
              <InfoCell icon={<Truck className="h-3.5 w-3.5" />} label="Modelo" value={detalhe.modelo} />
              <InfoCell icon={<User className="h-3.5 w-3.5" />} label="Motorista" value={detalhe.motorista_nome ?? detalhe.motorista_id} />
              <InfoCell icon={<Gauge className="h-3.5 w-3.5" />} label="KM informado" value={formatNumber(detalhe.km_informado)} />
              <InfoCell
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Horário"
                value={detalhe.criado_em ? new Date(detalhe.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
              />
            </div>

            {/* Foto do hodômetro */}
            <FotoPreview url={fotoHodometro?.signed_url ?? null} label="Foto do painel / hodômetro" />

            {/* Observações do motorista */}
            {(detalhe.observacao_corrigida_ia ?? detalhe.observacao_original) && (
              <div className="space-y-1">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <MessageSquare className="h-3 w-3" /> Observações do motorista
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
                  <AlertTriangle className="h-3 w-3" /> Itens com problema ({itensProblema.length})
                </p>
                {itensProblema.map((item) => {
                  const fotoItem = detalhe.fotos.find((f) => f.checklist_item_codigo === item.item_codigo);
                  return (
                    <div key={item.id} className={cn("rounded-lg border p-3", item.critico ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50")}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {item.item_nome}
                            {item.critico && (
                              <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">CRÍTICO</span>
                            )}
                          </p>
                          {item.observacao && <p className="mt-0.5 text-xs text-muted-foreground">{item.observacao}</p>}
                        </div>
                        <XCircle className={cn("mt-0.5 h-4 w-4 shrink-0", item.critico ? "text-red-600" : "text-amber-600")} />
                      </div>
                      {fotoItem?.signed_url && (
                        <div className="mt-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={fotoItem.signed_url} alt={item.item_nome} className="max-h-32 w-full rounded-md object-cover" loading="lazy" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Itens aprovados (colapsável) */}
            {detalhe.itens.filter((i) => i.status === "APTO").length > 0 && (
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-slate-700">
                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                  Itens aprovados ({detalhe.itens.filter((i) => i.status === "APTO").length})
                </summary>
                <div className="mt-2 space-y-1">
                  {detalhe.itens.filter((i) => i.status === "APTO").map((item) => (
                    <div key={item.id} className="flex items-center gap-2 rounded-md px-2 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span className="text-sm">{item.item_nome}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Histórico de ações de hoje */}
            {detalhe.historico_hoje.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Histórico de hoje</p>
                <div className="space-y-1.5">
                  {detalhe.historico_hoje.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs">
                      <span className={cn("mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        h.tipo_acao === "SAIDA" ? "bg-blue-100 text-blue-800" :
                        h.tipo_acao === "ENTRADA" ? "bg-emerald-100 text-emerald-800" :
                        h.tipo_acao === "BLOQUEIO" ? "bg-red-100 text-red-800" :
                        "bg-amber-100 text-amber-800"
                      )}>
                        {h.tipo_acao}
                      </span>
                      <div className="min-w-0">
                        {h.motivo_bloqueio && <p className="font-medium">{h.motivo_bloqueio}</p>}
                        <p className="text-muted-foreground">
                          {h.usuario_portaria_id} · {new Date(h.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold">Ações da portaria</p>

              {canLiberar && (
                <form action={registrarMovimentacaoPortariaAction}>
                  <input type="hidden" name="frota_id" value={detalhe.frota_id} />
                  <input type="hidden" name="checklist_id" value={detalhe.checklist_id} />
                  <input type="hidden" name="tipo_movimentacao" value="SAIDA" />
                  <Button type="submit" className="w-full">
                    <LogOut className="mr-2 h-4 w-4" /> Liberar saída
                  </Button>
                </form>
              )}

              {canEntrada && (
                <form action={registrarMovimentacaoPortariaAction}>
                  <input type="hidden" name="frota_id" value={detalhe.frota_id} />
                  <input type="hidden" name="checklist_id" value={detalhe.checklist_id} />
                  <input type="hidden" name="tipo_movimentacao" value="ENTRADA" />
                  <Button type="submit" variant="outline" className="w-full">
                    <LogIn className="mr-2 h-4 w-4" /> Registrar entrada
                  </Button>
                </form>
              )}

              {canBloquear && !showBloqueioForm && (
                <Button type="button" variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => { setShowBloqueioForm(true); setShowCorrecaoForm(false); }}>
                  <Lock className="mr-2 h-4 w-4" /> Bloquear saída
                </Button>
              )}
              {canBloquear && showBloqueioForm && (
                <form action={bloquearSaidaAction} className="space-y-2">
                  <input type="hidden" name="frota_id" value={detalhe.frota_id} />
                  <input type="hidden" name="checklist_id" value={detalhe.checklist_id} />
                  <Label htmlFor="motivo_bl" className="text-xs">Motivo do bloqueio</Label>
                  <textarea id="motivo_bl" name="motivo" rows={2} required placeholder="Ex: Pneu com corte visível..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <Button type="submit" variant="destructive" size="sm" className="flex-1">Confirmar bloqueio</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowBloqueioForm(false)}>Cancelar</Button>
                  </div>
                </form>
              )}

              {canCorrecao && !showCorrecaoForm && (
                <Button type="button" variant="outline" className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                  onClick={() => { setShowCorrecaoForm(true); setShowBloqueioForm(false); }}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Solicitar correção
                </Button>
              )}
              {canCorrecao && showCorrecaoForm && (
                <form action={solicitarCorrecaoAction} className="space-y-2">
                  <input type="hidden" name="frota_id" value={detalhe.frota_id} />
                  <input type="hidden" name="checklist_id" value={detalhe.checklist_id} />
                  <Label htmlFor="motivo_co" className="text-xs">O que precisa ser corrigido</Label>
                  <textarea id="motivo_co" name="motivo" rows={2} required placeholder="Ex: Foto ilegível, refazer..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <Button type="submit" variant="outline" size="sm" className="flex-1 border-amber-300 text-amber-800">Enviar solicitação</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowCorrecaoForm(false)}>Cancelar</Button>
                  </div>
                </form>
              )}

              {!canLiberar && !canEntrada && !canBloquear && !canCorrecao && (
                <p className="text-center text-sm text-muted-foreground">Nenhuma ação disponível para este status.</p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
