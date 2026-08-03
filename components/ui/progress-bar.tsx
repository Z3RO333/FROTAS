import { cn } from "@/lib/utils";

type ProgressTone = "blue" | "emerald" | "amber" | "red";

export function ProgressBar({
  value,
  tone = "blue",
  className,
  label,
}: {
  value: number;
  tone?: ProgressTone;
  className?: string;
  label: string;
}) {
  const normalizedValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;

  return (
    <progress
      className={cn("progress-bar", `progress-bar--${tone}`, className)}
      value={normalizedValue}
      max={100}
      aria-label={label}
    />
  );
}

