import { cn } from "@/lib/utils";
import { SEVERITY, severityFromStatus, formatStatus, type SeverityKey } from "@/lib/design/tokens";

const SIZE = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
  lg: "px-2.5 py-1 text-sm",
} as const;

export function StatusBadge({
  status,
  size = "md",
  className,
}: {
  status: string | null | undefined;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const sev = severityFromStatus(status);
  const tone = SEVERITY[sev];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium ring-1 ring-inset whitespace-nowrap",
        tone.badge,
        SIZE[size],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {formatStatus(status)}
    </span>
  );
}

export function SeverityBadge({
  severity,
  label,
  size = "md",
  className,
}: {
  severity: SeverityKey;
  label?: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const tone = SEVERITY[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium ring-1 ring-inset whitespace-nowrap uppercase tracking-wide",
        tone.badge,
        SIZE[size],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {label ?? severity}
    </span>
  );
}
