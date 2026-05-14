import { Wrench } from "lucide-react";
import { EnviarManutencaoDialog } from "./enviar-manutencao-dialog";
import { RetornarOperacaoDialog } from "./retornar-operacao-dialog";

type FrotaStatusInput = {
  id: number;
  label: string;
  status: string | null;
  manutencao_motivo?: string | null;
  manutencao_tipo?: string | null;
  manutencao_oficina?: string | null;
  manutencao_prev_retorno?: string | null;
  manutencao_observacao?: string | null;
  manutencao_iniciado_em?: string | null;
  manutencao_iniciado_por?: string | null;
};

function diffDias(isoStart: string | null): number | null {
  if (!isoStart) return null;
  const start = new Date(isoStart);
  if (isNaN(start.getTime())) return null;
  return Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function atrasada(prev: string | null | undefined): boolean {
  if (!prev) return false;
  const prevDate = new Date(prev);
  if (isNaN(prevDate.getTime())) return false;
  return prevDate.getTime() < Date.now();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

export function StatusOperacionalBanner({ frota }: { frota: FrotaStatusInput }) {
  const emManutencao = frota.status === "manutencao";

  if (!emManutencao) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Em operação</p>
            <p className="text-xs text-muted-foreground">
              Status atual: {frota.status ?? "—"}. Use o botão ao lado se a frota precisar entrar
              em manutenção.
            </p>
          </div>
        </div>
        <EnviarManutencaoDialog frotaId={frota.id} frotaLabel={frota.label} size="sm" />
      </div>
    );
  }

  const dias = diffDias(frota.manutencao_iniciado_em ?? null);
  const isAtrasada = atrasada(frota.manutencao_prev_retorno ?? null);

  return (
    <div className="space-y-3 rounded-lg border border-violet-300 bg-violet-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-violet-300">
            <Wrench className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-violet-900">Frota em manutenção</p>
              {dias != null && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-300">
                  {dias} dia{dias === 1 ? "" : "s"}
                </span>
              )}
              {isAtrasada && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-inset ring-red-300">
                  Prev. retorno vencida
                </span>
              )}
            </div>
            <p className="text-sm text-violet-800">
              <span className="font-medium">Motivo:</span> {frota.manutencao_motivo ?? "—"}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-violet-700">
              {frota.manutencao_tipo && (
                <span>
                  <span className="font-medium">Tipo:</span> {frota.manutencao_tipo}
                </span>
              )}
              {frota.manutencao_oficina && (
                <span>
                  <span className="font-medium">Oficina:</span> {frota.manutencao_oficina}
                </span>
              )}
              {frota.manutencao_prev_retorno && (
                <span>
                  <span className="font-medium">Prev. retorno:</span>{" "}
                  {formatDate(frota.manutencao_prev_retorno)}
                </span>
              )}
              {frota.manutencao_iniciado_em && (
                <span>
                  <span className="font-medium">Início:</span>{" "}
                  {formatDate(frota.manutencao_iniciado_em)}
                </span>
              )}
              {frota.manutencao_iniciado_por && (
                <span>
                  <span className="font-medium">Por:</span>{" "}
                  {frota.manutencao_iniciado_por.split("@")[0]}
                </span>
              )}
            </div>
            {frota.manutencao_observacao && (
              <p className="text-xs text-violet-700 italic">
                {frota.manutencao_observacao}
              </p>
            )}
          </div>
        </div>
        <RetornarOperacaoDialog frotaId={frota.id} frotaLabel={frota.label} size="sm" />
      </div>
    </div>
  );
}
