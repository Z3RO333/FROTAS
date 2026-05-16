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
import { EmptyState } from "@/components/ui/empty-state";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import type { SeverityKey } from "@/lib/design/tokens";

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

function formatRelative(iso: string): string {
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

  const items: TimelineItem[] = events.map((ev) => ({
    id: ev.id,
    title: (
      <div className="flex flex-wrap items-center gap-2">
        <span>{ev.titulo}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">
          {ev.tipo_evento.replace(/_/g, " ")}
        </span>
      </div>
    ),
    description: ev.descricao ?? undefined,
    timestamp: formatRelative(ev.criado_em),
    icon: ICONS[ev.tipo_evento] ?? ClipboardCheck,
    severity: (ev.severidade as SeverityKey | null | undefined) ?? "NEUTRO",
    meta: (
      <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
        {ev.usuario_id && <span>por {ev.usuario_id.split("@")[0]}</span>}
        <span>· {ev.origem}</span>
      </div>
    ),
  }));

  return <Timeline items={items} />;
}
