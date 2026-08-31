"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { UserCheck } from "lucide-react";
import type { ConcluirAtividadeActionState } from "@/app/(app)/motorista/atividades/_actions";
import { Button } from "@/components/ui/button";

const INITIAL_STATE: ConcluirAtividadeActionState = { error: null, attempt: 0 };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="outline" className="w-full" disabled={pending}>
      <UserCheck className="h-5 w-5" aria-hidden="true" />
      {pending ? "Pegando..." : "Pegar atividade"}
    </Button>
  );
}

export function PegarAtividadeForm({
  atividadeId,
  action,
}: {
  atividadeId: number;
  action: (state: ConcluirAtividadeActionState, formData: FormData) => Promise<ConcluirAtividadeActionState>;
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form key={state.attempt} action={formAction} className="w-full space-y-2">
      <input type="hidden" name="atividade_id" value={atividadeId} />
      {state.error ? <p className="text-sm font-medium text-red-700">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
