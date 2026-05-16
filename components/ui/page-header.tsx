import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEVERITY, type SeverityKey } from "@/lib/design/tokens";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: ComponentType<LucideProps>;
  severity?: SeverityKey;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon: Icon,
  severity = "INFO",
  className,
}: Props) {
  const tone = SEVERITY[severity];
  return (
    <div
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div
            className={cn(
              "hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm sm:flex",
              tone.tile
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 space-y-1">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 lg:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-3xl text-sm text-slate-500">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * PageHero — variante premium do PageHeader.
 * Card escuro/gradiente com slot para KPIs primários, usado nas telas executivas.
 */
type HeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ComponentType<LucideProps>;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PageHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: HeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-900/50 text-white shadow-[0_24px_48px_-24px_rgba(15,23,42,0.45)]",
        "bg-[linear-gradient(135deg,#0b1220_0%,#0f1c30_45%,#0b2747_100%)]",
        className
      )}
    >
      {/* Detalhes visuais de fundo */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-[0.25]",
          "bg-[radial-gradient(circle_at_12%_0%,rgba(59,130,246,0.55),transparent_45%),radial-gradient(circle_at_92%_110%,rgba(14,165,233,0.45),transparent_50%)]"
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-[0.07] bg-[length:36px_36px]",
          "bg-[linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)]"
        )}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
                <Icon className="h-5 w-5 text-blue-200" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 space-y-1.5">
              {eyebrow && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
                  {eyebrow}
                </p>
              )}
              <h1 className="text-2xl font-semibold tracking-tight text-white lg:text-3xl">
                {title}
              </h1>
              {description && (
                <p className="max-w-3xl text-sm text-slate-300">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>}
      </div>
    </section>
  );
}

/**
 * HeroStat — KPI compacto pensado para uso dentro do PageHero.
 */
export function HeroStat({
  label,
  value,
  hint,
  icon: Icon,
  severity = "INFO",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ComponentType<LucideProps>;
  severity?: SeverityKey;
}) {
  const tone = SEVERITY[severity];
  return (
    <div className="relative overflow-hidden rounded-xl bg-white/[0.06] p-3 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
      <span
        className={cn("absolute inset-x-0 top-0 h-[2px]", tone.bar)}
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-300/80 truncate">
            {label}
          </p>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-white">
            {value}
          </div>
          {hint && <p className="mt-0.5 text-[11px] text-slate-400 truncate">{hint}</p>}
        </div>
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-200 ring-1 ring-inset ring-white/10">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
