import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEVERITY, type SeverityKey } from "@/lib/design/tokens";

export type TimelineItem = {
  id: string | number;
  title: ReactNode;
  description?: ReactNode;
  timestamp?: ReactNode;
  icon?: ComponentType<LucideProps>;
  severity?: SeverityKey;
  meta?: ReactNode;
};

type TimelineProps = {
  items: TimelineItem[];
  emptyLabel?: string;
  className?: string;
};

export function Timeline({ items, emptyLabel = "Sem eventos no momento.", className }: TimelineProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ol className={cn("relative space-y-3", className)}>
      {/* Linha vertical contínua */}
      <span
        className="pointer-events-none absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent"
        aria-hidden="true"
      />
      {items.map((item) => {
        const severity = item.severity ?? "NEUTRO";
        const tone = SEVERITY[severity];
        const Icon = item.icon;
        return (
          <li key={item.id} className="relative pl-10">
            {/* Tile do ícone */}
            <span
              className={cn(
                "absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-lg ring-4 ring-white",
                tone.tile
              )}
            >
              {Icon ? (
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
              )}
            </span>

            <div className="rounded-lg border border-slate-200/70 bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">{item.title}</div>
                  {item.description && (
                    <div className="mt-0.5 text-xs text-slate-500">{item.description}</div>
                  )}
                </div>
                {item.timestamp && (
                  <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-400">
                    {item.timestamp}
                  </span>
                )}
              </div>
              {item.meta && <div className="mt-2 text-xs text-slate-600">{item.meta}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
