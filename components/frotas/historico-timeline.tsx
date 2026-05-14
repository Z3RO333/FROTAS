import {
  ClipboardCheck,
  Fuel,
  Gauge,
  History,
  ShieldAlert,
  SquarePen,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HistoricoEntry } from "@/lib/repos/historico";
import { formatDate } from "@/lib/utils";

const ICONS = {
  ABASTECIMENTO: Fuel,
  ALTERACAO: SquarePen,
  CHECKLIST: ClipboardCheck,
  KM: Gauge,
  PENDENCIA: ShieldAlert,
  PORTARIA: Warehouse,
} as const;

export function HistoricoTimeline({ entries }: { entries: HistoricoEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" aria-hidden="true" />
          Histórico completo da frota
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem eventos registrados para esta frota.</p>
        ) : (
          <ul className="space-y-4">
            {entries.map((h, index) => {
              const Icon = ICONS[h.tipo as keyof typeof ICONS] ?? History;
              return (
                <li
                  key={`${h.tipo ?? "evento"}-${h.id}-${index}`}
                  className="relative border-l-2 border-primary/20 pl-5"
                >
                  <span className="absolute -left-[13px] top-0 flex h-6 w-6 items-center justify-center rounded-full border bg-white text-primary">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-2 rounded-md border bg-slate-50 p-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm">{h.titulo ?? h.campo}</strong>
                        {h.tipo ? <Badge variant="outline">{labelTipo(h.tipo)}</Badge> : null}
                        {h.status ? <StatusBadge status={h.status} /> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(h.alterado_em)} · {h.motorista_nome ?? h.alterado_por}
                      </div>
                      {h.descricao ? <p className="break-words text-sm text-slate-700">{h.descricao}</p> : null}
                      <ValueChange entry={h} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ValueChange({ entry }: { entry: HistoricoEntry }) {
  if (!entry.valor_antigo && !entry.valor_novo) return null;

  if (!entry.valor_antigo) {
    return <div className="text-sm font-medium text-slate-900">{entry.valor_novo ?? "-"}</div>;
  }

  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{entry.valor_antigo}</span>
      <span className="px-2 text-muted-foreground">→</span>
      <strong>{entry.valor_novo ?? "-"}</strong>
    </div>
  );
}

function labelTipo(tipo: string) {
  const labels: Record<string, string> = {
    ABASTECIMENTO: "Abastecimento",
    ALTERACAO: "Cadastro",
    CHECKLIST: "Checklist",
    KM: "KM",
    PENDENCIA: "Pendência",
    PORTARIA: "Portaria",
  };
  return labels[tipo] ?? tipo;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const className =
    normalized.includes("CRIT") || normalized.includes("BLOQUE") || normalized.includes("NAO_APTO")
      ? "border-transparent bg-red-600 text-white hover:bg-red-600"
      : normalized.includes("PEND")
        ? "border-transparent bg-amber-500 text-white hover:bg-amber-500"
        : normalized.includes("APROV") || normalized.includes("VALID") || normalized.includes("SAIDA")
          ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-600"
          : "";

  return (
    <Badge variant={className ? "default" : "outline"} className={className}>
      {status}
    </Badge>
  );
}
