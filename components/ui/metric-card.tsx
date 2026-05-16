import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEVERITY, type SeverityKey } from "@/lib/design/tokens";

type Props = {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ComponentType<LucideProps>;
  severity?: SeverityKey;
  href?: string;
  trend?: { value: number; label?: string };
  className?: string;
};

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  severity = "NEUTRO",
  href,
  trend,
  className,
}: Props) {
  const tone = SEVERITY[severity];

  const inner = (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 transition-all duration-200",
        "shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)]",
        "hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-[0_2px_0_rgba(15,23,42,0.04),0_16px_32px_-12px_rgba(15,23,42,0.22)]",
        href && "cursor-pointer",
        className
      )}
    >
      {/* Barra superior colorida por severidade */}
      <span
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-[3px] opacity-90 transition-opacity group-hover:opacity-100",
          tone.bar
        )}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} />
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500 truncate">
              {label}
            </p>
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-950 sm:text-[28px]">
            {value}
          </div>
          {(hint || trend) && (
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              {trend && (
                <span
                  className={cn(
                    "tabular-nums font-medium",
                    trend.value > 0
                      ? "text-emerald-600"
                      : trend.value < 0
                        ? "text-red-600"
                        : "text-slate-500"
                  )}
                >
                  {trend.value > 0 ? "▲" : trend.value < 0 ? "▼" : "—"} {Math.abs(trend.value).toFixed(1)}%
                  {trend.label ? ` ${trend.label}` : ""}
                </span>
              )}
              {hint && <span className="truncate">{hint}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-[1.04]",
              tone.tile
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        )}
      </div>
      {href && (
        <ArrowUpRight
          className="absolute right-3 bottom-3 h-3.5 w-3.5 text-slate-300 opacity-0 transition-all duration-200 group-hover:right-[10px] group-hover:bottom-[10px] group-hover:opacity-100 group-hover:text-slate-500"
          aria-hidden="true"
        />
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {inner}
      </Link>
    );
  }

  return inner;
}

export function MetricGrid({
  children,
  cols = 4,
  className,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  const grid = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
    6: "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  }[cols];
  return <div className={cn("grid gap-3", grid, className)}>{children}</div>;
}
