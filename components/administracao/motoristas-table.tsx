"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronRight, ExternalLink, Loader2, Truck, UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MotoristaFrotaHistorico, MotoristaStats } from "@/lib/repos/motoristas";
import { formatDate } from "@/lib/utils";

type HistoryResponse = {
  frotas?: MotoristaFrotaHistorico[];
  error?: string;
};

export function MotoristasTable({ motoristas }: { motoristas: MotoristaStats[] }) {
  const [selected, setSelected] = useState<MotoristaStats | null>(null);
  const [frotas, setFrotas] = useState<MotoristaFrotaHistorico[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  async function openHistory(motorista: MotoristaStats) {
    const requestId = ++requestIdRef.current;
    setSelected(motorista);
    setFrotas([]);
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/administracao/motoristas/frotas?motorista_id=${encodeURIComponent(motorista.motorista_id)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as HistoryResponse;
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar as frotas.");
      if (requestId !== requestIdRef.current) return;
      setFrotas(payload.frotas ?? []);
    } catch (cause) {
      if (requestId !== requestIdRef.current) return;
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as frotas.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b">
              <th className="p-3 text-left font-medium text-muted-foreground">Motorista</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Movimentações</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Frotas distintas</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Saídas</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Última movimentação</th>
              <th className="w-10 p-3"><span className="sr-only">Abrir detalhes</span></th>
            </tr>
          </thead>
          <tbody>
            {motoristas.map((motorista) => (
              <tr
                key={motorista.motorista_id}
                role="button"
                tabIndex={0}
                aria-label={`Ver frotas utilizadas por ${motorista.motorista_nome ?? motorista.motorista_id}`}
                onClick={() => void openHistory(motorista)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void openHistory(motorista);
                  }
                }}
                className="cursor-pointer border-b outline-none transition-colors odd:bg-white even:bg-slate-50/60 last:border-0 hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
              >
                <td className="p-3">
                  <div className="font-medium text-blue-950">{motorista.motorista_nome ?? motorista.motorista_id}</div>
                  <div className="text-xs text-muted-foreground">{motorista.motorista_id}</div>
                </td>
                <td className="p-3 text-right tabular-nums">{motorista.total_movimentacoes.toLocaleString("pt-BR")}</td>
                <td className="p-3 text-right tabular-nums">{motorista.frotas_distintas}</td>
                <td className="p-3 text-right tabular-nums">{motorista.total_saidas.toLocaleString("pt-BR")}</td>
                <td className="p-3 text-right">
                  {motorista.ultima_movimentacao ? formatDate(motorista.ultima_movimentacao) : "—"}
                </td>
                <td className="p-3 text-right text-blue-600"><ChevronRight className="ml-auto h-4 w-4" /></td>
              </tr>
            ))}
            {motoristas.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Nenhuma movimentação registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) {
            requestIdRef.current += 1;
            setSelected(null);
            setLoading(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3 pr-10">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate">{selected?.motorista_nome ?? selected?.motorista_id}</DialogTitle>
                <DialogDescription className="truncate">{selected?.motorista_id}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selected && (
            <div className="grid grid-cols-3 gap-2">
              <Summary label="Movimentações" value={selected.total_movimentacoes} />
              <Summary label="Frotas" value={selected.frotas_distintas} />
              <Summary label="Saídas" value={selected.total_saidas} />
            </div>
          )}

          {loading && (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />
              Carregando frotas utilizadas...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && frotas.length === 0 && (
            <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
              Nenhuma frota encontrada para este motorista.
            </div>
          )}

          {!loading && !error && frotas.length > 0 && (
            <div className="max-h-[50dvh] space-y-2 overflow-y-auto pr-1">
              {frotas.map((frota) => (
                <article key={frota.frota_id} className="grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-blue-700">
                      <Truck className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">Frota {frota.frota_geral ?? `#${frota.frota_id}`}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Placa {frota.placa ?? "não informada"}{frota.modelo ? ` · ${frota.modelo}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm sm:text-right">
                    <p className="font-medium tabular-nums">{frota.qtd_movimentacoes.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground">movimentação(ões)</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                    <div>
                      <p className="text-sm font-medium">{frota.ultima_vez ? formatDate(frota.ultima_vez) : "—"}</p>
                      <p className="text-xs text-muted-foreground">última utilização</p>
                    </div>
                    <Link
                      href={`/frotas/${frota.frota_id}`}
                      className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      Ver frota <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-3 text-center">
      <p className="text-lg font-semibold tabular-nums">{value.toLocaleString("pt-BR")}</p>
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
