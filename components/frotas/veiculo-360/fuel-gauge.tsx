import { cn } from "@/lib/utils";

type Props = {
  label: string;
  nivel: number | null | undefined;
  atualizadoEm?: string | null;
  origem?: string | null;
  className?: string;
};

function toneFor(nivel: number): { fill: string; text: string; legend: string } {
  if (nivel === 1) {
    return {
      fill: "border-amber-500 bg-amber-500",
      text: "text-amber-700",
      legend: "Baixo",
    };
  }
  if (nivel === 4) {
    return {
      fill: "border-emerald-500 bg-emerald-500",
      text: "text-emerald-700",
      legend: "Cheio",
    };
  }
  return {
    fill: "border-blue-500 bg-blue-500",
    text: "text-blue-700",
    legend: "",
  };
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

export function FuelGauge({ label, nivel, atualizadoEm, origem, className }: Props) {
  const value = nivel ?? 0;
  const hasReading = nivel != null && nivel > 0;
  const tone = toneFor(value);

  return (
    <div className={cn("rounded-lg border bg-white p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {hasReading && (
          <span className={cn("text-xs font-semibold tabular-nums", tone.text)}>
            {value}/4{tone.legend ? ` · ${tone.legend}` : ""}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-1.5">
        {[1, 2, 3, 4].map((level) => {
          const filled = level <= value;
          return (
            <div
              key={level}
              className={cn(
                "h-7 flex-1 rounded border-2 transition-colors",
                filled ? tone.fill : "border-slate-200 bg-white"
              )}
            />
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {hasReading
          ? `Atualizado em ${formatDate(atualizadoEm)}${origem ? ` · ${origem.replace(/_/g, " ")}` : ""}`
          : "Sem leitura registrada"}
      </p>
    </div>
  );
}
