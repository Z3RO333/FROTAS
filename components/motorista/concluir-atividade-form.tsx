"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Camera, Check } from "lucide-react";
import type { ConcluirAtividadeActionState } from "@/app/(app)/motorista/atividades/_actions";
import { Button } from "@/components/ui/button";

const INITIAL_STATE: ConcluirAtividadeActionState = { error: null, attempt: 0 };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Check className="h-4 w-4" aria-hidden="true" />
      {pending ? "Concluindo..." : "Concluir"}
    </Button>
  );
}

export function ConcluirAtividadeForm({
  atividadeId,
  exigeFoto,
  action,
}: {
  atividadeId: number;
  exigeFoto: boolean;
  action: (state: ConcluirAtividadeActionState, formData: FormData) => Promise<ConcluirAtividadeActionState>;
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [fotoNome, setFotoNome] = useState<string>("");

  return (
    <form key={state.attempt} action={formAction} className="space-y-2">
      <input type="hidden" name="atividade_id" value={atividadeId} />
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">
        <Camera className="h-4 w-4" aria-hidden="true" />
        {fotoNome
          ? fotoNome
          : exigeFoto
            ? "Foto de chegada (obrigatória)"
            : "Foto (opcional)"}
        <input
          type="file"
          name="foto"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => setFotoNome(e.target.files?.[0]?.name ?? "")}
        />
      </label>
      {state.error ? <p className="text-xs font-medium text-red-700">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
