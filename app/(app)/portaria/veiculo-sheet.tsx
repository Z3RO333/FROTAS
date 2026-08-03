"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, Clock, Gauge, LogOut,
  Lock, MessageSquare, RefreshCw, Truck, User, ChevronRight, XCircle, ImageOff,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn, formatNumber } from "@/lib/utils";
import { PortariaSubmitButton } from "./portaria-submit-button";
import {
  registrarMovimentacaoPortariaAction,
  bloquearSaidaAction,
  liberarSaidaForcadaAction,
  solicitarCorrecaoAction,
} from "./_actions";

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

// Wrapper que adiciona toast após ação de portaria
function withToast(
  action: (fd: FormData) => Promise<void>,
  successMsg: string
): (fd: FormData) => Promise<void> {
  return async (fd) => {
    try {
      await action(fd);
      toast.success(successMsg);
    } catch (error) {
      if (isNextRedirect(error)) throw error;
      const msg = error instanceof Error ? error.message : "Algo deu errado. Tente novamente.";
      toast.error(msg);
    }
  };
}
import type { ChecklistDetalhePortaria } from "@/lib/repos/portaria-detail";
import type { StatusPortaria } from "@/lib/repos/checklists";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detalhe: ChecklistDetalhePortaria | null;
  loading: boolean;
  statusPortaria: StatusPortaria | null;
  canApproveExit: boolean;
};

const STATUS_GERAL_CLASS: Record<string, string> = {
  APROVADO: "border-emerald-200 bg-emerald-50 text-emerald-800",
  COM_OBSERVACAO: "border-amber-200 bg-amber-50 text-amber-800",
  NAO_APTO: "border-red-200 bg-red-50 text-red-800",
  CRITICO: "border-red-300 bg-red-100 text-red-900",
};

function FotoPreview({ url, label }: { url: string | null; label: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!url) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="relative overflow-hidden rounded-lg border bg-slate-100">
        {!loaded && !error && (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          </div>
        )}
        {error ? (
          <div className="flex h-24 flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageOff className="h-6 w-6 opacity-40" />
            <span className="text-xs">Imagem não disponível</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className={cn("h-auto w-full object-contain transition-opacity", loaded ? "opacity-100" : "opacity-0")}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => { setError(true); setLoaded(true); }}
          />
        )}
      </div>
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

export function VeiculoSheet({
  open,
  onOpenChange,
  detalhe,
  loading,
  statusPortaria,
  canApproveExit,
}: Props) {
  const [showBloqueioForm, setShowBloqueioForm] = useState(false);
  const [showCorrecaoForm, setShowCorrecaoForm] = useState(false);

  const canLiberar = statusPortaria === "LIBERADA_SAIDA";
  // A portaria registra a movimentação física; apenas aprovadores autorizam exceções.
  const canBloquear = statusPortaria === "LIBERADA_SAIDA";
  const canCorrecao = statusPortaria === "BLOQUEADA_CHECKLIST" || statusPortaria === "CHECKLIST_REALIZADO";
  // Liberação forçada com justificativa quando houver itens obrigatórios inconforme
  const canLiberarForcado = canApproveExit && statusPortaria === "BLOQUEADA_CHECKLIST";

  const itensProblema = detalhe?.itens.filter((i) => i.status === "NAO_APTO") ?? [];
  const itensObrigatoriosInconformes = itensProblema.filter((i) => i.obrigatorio);
  const itensNaoObrigatoriosInconformes = itensProblema.filter((i) => !i.obrigatorio);
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
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("text-sm", STATUS_GERAL_CLASS[detalhe.status_geral ?? ""] ?? "")}>
                {detalhe.status_geral ?? "—"}
              </Badge>
              {itensObrigatoriosInconformes.length > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  <XCircle className="h-3 w-3" />
                  {itensObrigatoriosInconformes.length} obrigatório(s) inconforme(s) — bloqueado
                </span>
              )}
              {itensNaoObrigatoriosInconformes.length > 0 && itensObrigatoriosInconformes.length === 0 && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  {itensNaoObrigatoriosInconformes.length} observação(ões) — liberação permitida
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
            <FotoPreview
              key={fotoHodometro?.signed_url ?? "sem-foto-hodometro"}
              url={fotoHodometro?.signed_url ?? null}
              label="Foto do painel / hodômetro"
            />

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

            {/* Itens obrigatórios inconforme (impedem liberação) */}
            {itensObrigatoriosInconformes.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-red-600">
                  <XCircle className="h-3 w-3" /> Itens obrigatórios inconforme — impedem liberação ({itensObrigatoriosInconformes.length})
                </p>
                {itensObrigatoriosInconformes.map((item) => {
                  const fotoItem = detalhe.fotos.find((f) => f.checklist_item_codigo === item.item_codigo);
                  return (
                    <div key={item.id} className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {item.item_nome}
                            <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">OBRIGATÓRIO</span>
                            {item.critico && <span className="ml-1 rounded-full bg-red-800 px-1.5 py-0.5 text-[9px] font-bold text-white">CRÍTICO</span>}
                          </p>
                          {item.observacao && <p className="mt-0.5 text-xs text-muted-foreground">{item.observacao}</p>}
                        </div>
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
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

            {/* Itens não-obrigatórios (observações — não impedem liberação) */}
            {itensNaoObrigatoriosInconformes.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> Observações (não impedem liberação — {itensNaoObrigatoriosInconformes.length})
                </p>
                {itensNaoObrigatoriosInconformes.map((item) => {
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
                <form action={withToast(registrarMovimentacaoPortariaAction, "Saída registrada com sucesso!")}>
                  <input type="hidden" name="frota_id" value={detalhe.frota_id} />
                  <input type="hidden" name="checklist_id" value={detalhe.checklist_id} />
                  <input type="hidden" name="tipo_movimentacao" value="SAIDA" />
                  <PortariaSubmitButton loadingText="Registrando saída...">
                    <LogOut className="mr-2 h-4 w-4" /> Registrar saída
                  </PortariaSubmitButton>
                </form>
              )}

              {canBloquear && !showBloqueioForm && (
                <Button type="button" variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => { setShowBloqueioForm(true); setShowCorrecaoForm(false); }}>
                  <Lock className="mr-2 h-4 w-4" /> Bloquear saída
                </Button>
              )}
              {canBloquear && showBloqueioForm && (
                <form action={withToast(bloquearSaidaAction, "Saída bloqueada e registrada.")} className="space-y-2">
                  <input type="hidden" name="frota_id" value={detalhe.frota_id} />
                  <input type="hidden" name="checklist_id" value={detalhe.checklist_id} />
                  <Label htmlFor="motivo_bl" className="text-xs">Motivo do bloqueio</Label>
                  <textarea id="motivo_bl" name="motivo" rows={2} required placeholder="Ex: Pneu com corte visível..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <PortariaSubmitButton variant="destructive" size="sm" loadingText="Bloqueando...">Confirmar bloqueio</PortariaSubmitButton>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowBloqueioForm(false)}>Cancelar</Button>
                  </div>
                </form>
              )}

              {/* Liberação forçada — quando itens obrigatórios estão inconforme */}
              {canLiberarForcado && !showCorrecaoForm && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="font-semibold">Veículo bloqueado por itens obrigatórios inconforme.</p>
                  <p className="mt-0.5">Para liberar mesmo assim, registre uma justificativa.</p>
                </div>
              )}
              {!canApproveExit && statusPortaria === "BLOQUEADA_CHECKLIST" && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  <p className="font-semibold">Aguardando decisão de um aprovador.</p>
                  <p className="mt-0.5">A portaria não pode aprovar ou liberar uma saída bloqueada.</p>
                </div>
              )}
              {canLiberarForcado && !showCorrecaoForm && (
                <Button type="button" variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => { setShowCorrecaoForm(true); setShowBloqueioForm(false); }}>
                  <LogOut className="mr-2 h-4 w-4" /> Aprovar com justificativa
                </Button>
              )}
              {canLiberarForcado && showCorrecaoForm && (
                <form action={withToast(liberarSaidaForcadaAction, "Liberação forçada registrada.")} className="space-y-2">
                  <input type="hidden" name="frota_id" value={detalhe.frota_id} />
                  <input type="hidden" name="checklist_id" value={detalhe.checklist_id} />
                  <input type="hidden" name="tipo_movimentacao" value="SAIDA" />
                  <Label htmlFor="motivo_forcado" className="text-xs font-semibold text-amber-800">
                    Justificativa obrigatória para liberação forçada
                  </Label>
                  <textarea id="motivo_forcado" name="observacao" rows={2} required
                    placeholder="Ex: Risco avaliado e saída autorizada pelo aprovador responsável..."
                    className="w-full rounded-md border border-amber-300 bg-background px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <PortariaSubmitButton size="sm" className="flex-1 bg-amber-600 hover:bg-amber-700" loadingText="Liberando...">Confirmar liberação</PortariaSubmitButton>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowCorrecaoForm(false)}>Cancelar</Button>
                  </div>
                </form>
              )}

              {/* Solicitar correção */}
              {canCorrecao && !showCorrecaoForm && !canLiberarForcado && (
                <Button type="button" variant="outline" className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                  onClick={() => { setShowCorrecaoForm(true); setShowBloqueioForm(false); }}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Solicitar correção ao motorista
                </Button>
              )}
              {canCorrecao && showCorrecaoForm && !canLiberarForcado && (
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

              {!canLiberar && !canBloquear && !canCorrecao && !canLiberarForcado && (
                <p className="text-center text-sm text-muted-foreground">Nenhuma ação disponível para este status.</p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
