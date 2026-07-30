"use client";

import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEVERITY, type SeverityKey } from "@/lib/design/tokens";

type FilterBarProps = {
  children?: ReactNode;
  /** Quando true, aplica `sticky top-14` para grudar abaixo do header da AppShell. */
  sticky?: boolean;
  className?: string;
};

export function FilterBar({ children, sticky = false, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white/85 p-3 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] backdrop-blur-md",
        sticky && "sm:sticky sm:top-14 sm:z-20",
        className
      )}
    >
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
    </div>
  );
}

type SearchInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
};

export function FilterSearch({ value, onChange, placeholder = "Buscar…", className }: SearchInputProps) {
  return (
    <div className={cn("relative min-w-0 flex-1 sm:max-w-xs", className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-11 text-base text-slate-900 placeholder:text-slate-400 sm:h-9 sm:pr-8 sm:text-sm",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        )}
      />
      {value && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => onChange("")}
          className="absolute right-0.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 sm:right-1 sm:h-8 sm:w-8"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

type FilterChipProps = {
  label: ReactNode;
  active?: boolean;
  onClick?: () => void;
  count?: number | string;
  icon?: ComponentType<LucideProps>;
  severity?: SeverityKey;
  className?: string;
};

export function FilterChip({
  label,
  active,
  onClick,
  count,
  icon: Icon,
  severity,
  className,
}: FilterChipProps) {
  const tone = severity ? SEVERITY[severity] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-all duration-150 sm:h-9",
        active
          ? cn(
              "border-blue-300 bg-blue-50 text-blue-800 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)]",
              tone && "border-transparent",
              tone?.badge
            )
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
        className
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span className="truncate">{label}</span>
      {count != null && (
        <span
          className={cn(
            "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
            active ? "bg-white/70 text-current" : "bg-slate-100 text-slate-600"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function FilterGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-lg bg-slate-50 p-1 ring-1 ring-inset ring-slate-200", className)}>
      {children}
    </div>
  );
}

export function FilterDivider() {
  return <div className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />;
}
