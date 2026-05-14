import {
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Fuel,
  Gauge,
  ShieldAlert,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { VeiculoEventoRow } from "@/lib/services/veiculo-eventos";
import { SeverityBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

const ICONS: Record<string, LucideIcon> = {
  CHECKLIST_ENVIADO: ClipboardCheck,
  KM_ALTERADO: Gauge,
  KM_DIVERGENTE: Gauge,
  COMBUSTIVEL_REGISTRADO: Fuel,
  STATUS_ALTERADO: AlertTriangle,
  PENDENCIA_CRIADA: AlertTriangle,
  PENDENCIA_RESOLVIDA: ClipboardCheck,
  DOCUMENTO_VENCENDO: FileText,
  DOCUMENTO_VENCIDO: FileText,
  MANUTENCAO_ATRASADA: Wrench,
  PNEU_CRITICO: Truck,
  ALERTA_CRIADO: ShieldAlert,
  ALERTA_RESOLVIDO: ShieldAlert,
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function EventsTimeline({ events }: { events: VeiculoEventoRow[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="Sem eventos registrados"
        description="Quando o veículo receber checklists, alterações de KM, ou alertas, eles aparecerão aqui."
      />
    );
  }

  return (
    <ol className="relative space-y-3 pl-6">
      <span className="absolute left-[10px] top-2 bottom-2 w-px bg-slate-200" aria-hidden="true" />
      {events.map((ev) => {
        const Icon = ICONS[ev.tipo_evento] ?? ClipboardCheck;
        return (
          <li key={ev.id} className="relative">
            <span className="absolute -left-6 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
              <Icon className="h-3 w-3 text-slate-500" aria-hidden="true" />
            </span>
            <div className="rounded-lg border bg-white p-3 hover:border-slate-300">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{ev.titulo}</span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {ev.tipo_evento.replace(/_/g, " ")}
                    </span>
                  </div>
                  {ev.descricao && (
                    <p className="mt-1 text-xs text-muted-foreground">{ev.descricao}</p>
                  )}
                  <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
                    <span>{formatDate(ev.criado_em)}</span>
                    {ev.usuario_id && <span>· {ev.usuario_id.split("@")[0]}</span>}
                    <span>· {ev.origem}</span>
                  </div>
                </div>
                {ev.severidade && (
                  <SeverityBadge severity={ev.severidade} size="sm" />
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
