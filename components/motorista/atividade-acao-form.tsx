"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import type { ConcluirAtividadeActionState } from "@/app/(app)/motorista/atividades/_actions";
import { Button } from "@/components/ui/button";

const INITIAL_STATE: ConcluirAtividadeActionState = { error: null, attempt: 0 };

function SubmitButton({
  label,
  labelPending,
  icon: Icon,
  variant,
}: {
  label: string;
  labelPending: string;
  icon: ComponentType<LucideProps>;
  variant?: "default" | "outline";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant={variant} className="w-full" disabled={pending}>
      <Icon className="h-5 w-5" aria-hidden="true" />
      {pending ? labelPending : label}
    </Button>
  );
}

/** Botão de ação simples sobre uma atividade (pegar, iniciar). */
export function AtividadeAcaoForm({
  atividadeId,
  action,
  label,
  labelPending,
  icon,
  variant,
}: {
  atividadeId: number;
  action: (state: ConcluirAtividadeActionState, formData: FormData) => Promise<ConcluirAtividadeActionState>;
  label: string;
  labelPending: string;
  icon: ComponentType<LucideProps>;
  variant?: "default" | "outline";
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form key={state.attempt} action={formAction} className="w-full space-y-2">
      <input type="hidden" name="atividade_id" value={atividadeId} />
      {state.error ? <p className="text-sm font-medium text-red-700">{state.error}</p> : null}
      <SubmitButton label={label} labelPending={labelPending} icon={icon} variant={variant} />
    </form>
  );
}
