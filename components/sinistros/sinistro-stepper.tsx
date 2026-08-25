"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type SinistroStepId = "urgencia" | "ocorrencia" | "terceiros" | "evidencias" | "revisao";

export const SINISTRO_STEPS: { id: SinistroStepId; label: string }[] = [
  { id: "urgencia", label: "Urgência" },
  { id: "ocorrencia", label: "Ocorrência" },
  { id: "terceiros", label: "Terceiros" },
  { id: "evidencias", label: "Evidências" },
  { id: "revisao", label: "Revisão" },
];

export function sinistroStepIndex(id: SinistroStepId): number {
  return SINISTRO_STEPS.findIndex((s) => s.id === id);
}

/**
 * Stepper do wizard de sinistro. Só permite clicar em passos já alcançados
 * (furthestReached) — não dá pra pular etapa sem passar pela validação dela.
 */
export function SinistroStepper({
  current,
  furthestReached,
  onSelect,
}: {
  current: SinistroStepId;
  furthestReached: SinistroStepId;
  onSelect: (id: SinistroStepId) => void;
}) {
  const currentIndex = sinistroStepIndex(current);
  const furthestIndex = sinistroStepIndex(furthestReached);

  return (
    <nav aria-label="Etapas do sinistro" className="flex items-start">
      {SINISTRO_STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        const isReachable = index <= furthestIndex;
        return (
          <button
            key={step.id}
            type="button"
            disabled={!isReachable}
            aria-current={isActive ? "step" : undefined}
            onClick={() => isReachable && onSelect(step.id)}
            className={cn(
              "group relative flex flex-1 flex-col items-center gap-1.5 pb-1 pt-0.5 text-center",
              !isReachable && "cursor-not-allowed"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute left-[-50%] top-[13px] h-0.5 w-full",
                index === 0 ? "hidden" : isDone ? "bg-emerald-500" : "bg-slate-200"
              )}
            />
            <span
              className={cn(
                "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors",
                isDone && "border-emerald-500 bg-emerald-500 text-white",
                isActive && "border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100",
                !isDone && !isActive && "border-slate-300 bg-white text-slate-400",
                isReachable && !isActive && "group-hover:border-blue-400"
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-[10.5px] font-semibold",
                isActive ? "text-blue-700" : isDone ? "text-slate-600" : "text-slate-400"
              )}
            >
              {step.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
