import { cn } from "@/lib/utils";

type Props = {
  label: string;
  nivel: number | null | undefined;
  atualizadoEm?: string | null;
  origem?: string | null;
  className?: string;
};

function toneFor(nivel: number): { text: string; legend: string } {
  if (nivel === 1) {
    return {
      text: "text-red-600",
      legend: "Baixo",
    };
  }
  if (nivel === 2) {
    return {
      text: "text-amber-600",
      legend: "",
    };
  }
  if (nivel === 3) {
    return {
      text: "text-blue-600",
      legend: "",
    };
  }
  if (nivel === 4) {
    return {
      text: "text-emerald-600",
      legend: "Cheio",
    };
  }
  return {
    text: "text-muted-foreground",
    legend: "",
  };
}

function levelTone(level: number): string {
  if (level === 1) return "bg-red-400 shadow-sm shadow-red-200";
  if (level === 2) return "bg-amber-400 shadow-sm shadow-amber-200";
  if (level === 3) return "bg-blue-400 shadow-sm shadow-blue-200";
  return "bg-emerald-400 shadow-sm shadow-emerald-200";
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
    <div className={cn("rounded-xl border bg-white p-4", className)}>
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

      {/* Barra segmentada em pílulas */}
      <div className="mt-3 flex gap-1.5">
        {[1, 2, 3, 4].map((level) => {
          const filled = level <= value;
          return (
            <div
              key={level}
              className={cn(
                "h-3 flex-1 rounded-full transition-all duration-300",
                filled ? levelTone(level) : "bg-slate-100"
              )}
            />
          );
        })}
      </div>

      <p className="mt-2.5 text-[11px] text-muted-foreground">
        {hasReading
          ? `Atualizado em ${formatDate(atualizadoEm)}${origem ? ` · ${origem.replace(/_/g, " ")}` : ""}`
          : "Sem leitura registrada"}
      </p>
    </div>
  );
}
