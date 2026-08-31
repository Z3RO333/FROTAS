"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Camera, Check } from "lucide-react";
import type { ConcluirAtividadeActionState } from "@/app/(app)/motorista/atividades/_actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const INITIAL_STATE: ConcluirAtividadeActionState = { error: null, attempt: 0 };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      <Check className="h-5 w-5" aria-hidden="true" />
      {pending ? "Concluindo..." : "Concluir atividade"}
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
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const prevAttempt = useRef(INITIAL_STATE.attempt);

  // Limpa preview quando o formulário é reiniciado por erro (attempt muda)
  useEffect(() => {
    if (state.attempt === prevAttempt.current) return;
    prevAttempt.current = state.attempt;
    setFotoPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setFotoNome("");
  }, [state.attempt]);

  // Revoga blob URL ao desmontar o componente — evita memory leak
  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  return (
    <form key={state.attempt} action={formAction} className="w-full space-y-3">
      <input type="hidden" name="atividade_id" value={atividadeId} />
      <label
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground transition-colors overflow-hidden",
          fotoPreview
            ? "min-h-0 border-blue-200 bg-white p-0 hover:bg-slate-50"
            : "min-h-20 border-slate-200 bg-slate-50 p-3 hover:bg-slate-100"
        )}
      >
        {fotoPreview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotoPreview}
              alt="Preview da foto de chegada"
              className="w-full max-h-48 object-contain rounded-md bg-slate-100"
            />
            <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
              Trocar foto
            </span>
          </>
        ) : (
          <>
            <Camera className="mb-1.5 h-5 w-5 text-blue-600" aria-hidden="true" />
            {exigeFoto ? "Foto de chegada (obrigatória)" : "Foto (opcional)"}
            {fotoNome ? (
              <span className="mt-0.5 text-xs font-medium text-slate-700 line-clamp-1">{fotoNome}</span>
            ) : null}
          </>
        )}
        <input
          type="file"
          name="foto"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Revoga URL anterior antes de criar nova
            if (fotoPreview) URL.revokeObjectURL(fotoPreview);
            if (file) {
              setFotoPreview(URL.createObjectURL(file));
              setFotoNome(file.name);
            } else {
              setFotoPreview(null);
              setFotoNome("");
            }
          }}
        />
      </label>
      {state.error ? (
        <p className="text-sm font-medium text-red-700">{state.error}</p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
