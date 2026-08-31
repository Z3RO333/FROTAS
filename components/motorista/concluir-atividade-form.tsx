"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Camera, Check, X } from "lucide-react";
import type { ConcluirAtividadeActionState } from "@/app/(app)/motorista/atividades/_actions";
import { MAX_FOTOS_ATIVIDADE } from "@/lib/atividades/rules";
import { Button } from "@/components/ui/button";

const INITIAL_STATE: ConcluirAtividadeActionState = { error: null, attempt: 0 };

type FotoSelecionada = { file: File; url: string };

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
  const [fotos, setFotos] = useState<FotoSelecionada[]>([]);
  const seletorRef = useRef<HTMLInputElement>(null);
  const envioRef = useRef<HTMLInputElement>(null);
  const prevAttempt = useRef(INITIAL_STATE.attempt);

  // O seletor visível não é o campo enviado: ele só acumula as fotos no estado,
  // permitindo tirar uma de cada vez. O campo de envio é sincronizado abaixo.
  useEffect(() => {
    if (!envioRef.current) return;
    const dt = new DataTransfer();
    for (const foto of fotos) dt.items.add(foto.file);
    envioRef.current.files = dt.files;
  }, [fotos]);

  // Limpa a seleção quando o formulário reinicia por erro.
  useEffect(() => {
    if (state.attempt === prevAttempt.current) return;
    prevAttempt.current = state.attempt;
    setFotos((atuais) => {
      for (const foto of atuais) URL.revokeObjectURL(foto.url);
      return [];
    });
  }, [state.attempt]);

  function adicionar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setFotos((atuais) => {
      const espaco = MAX_FOTOS_ATIVIDADE - atuais.length;
      const novas = Array.from(lista)
        .slice(0, Math.max(0, espaco))
        .map((file) => ({ file, url: URL.createObjectURL(file) }));
      return [...atuais, ...novas];
    });
    // Permite escolher o mesmo arquivo de novo (o onChange não dispara se o
    // valor não mudar).
    if (seletorRef.current) seletorRef.current.value = "";
  }

  function remover(url: string) {
    setFotos((atuais) => {
      URL.revokeObjectURL(url);
      return atuais.filter((foto) => foto.url !== url);
    });
  }

  const cheio = fotos.length >= MAX_FOTOS_ATIVIDADE;

  return (
    <form key={state.attempt} action={formAction} className="w-full space-y-3">
      <input type="hidden" name="atividade_id" value={atividadeId} />
      <input ref={envioRef} type="file" name="fotos" multiple accept="image/*" className="sr-only" tabIndex={-1} />
      <input
        ref={seletorRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(e) => adicionar(e.target.files)}
      />

      {fotos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {fotos.map((foto) => (
            <div key={foto.url} className="relative overflow-hidden rounded-md border bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.url} alt="Foto da atividade" className="h-24 w-full object-cover" />
              <button
                type="button"
                onClick={() => remover(foto.url)}
                aria-label="Remover foto"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={cheio}
        onClick={() => seletorRef.current?.click()}
      >
        <Camera className="h-5 w-5" aria-hidden="true" />
        {cheio
          ? `Limite de ${MAX_FOTOS_ATIVIDADE} fotos`
          : fotos.length > 0
            ? `Adicionar outra foto (${fotos.length}/${MAX_FOTOS_ATIVIDADE})`
            : exigeFoto
              ? "Tirar foto de chegada (obrigatória)"
              : "Tirar foto (opcional)"}
      </Button>

      {state.error ? <p className="text-sm font-medium text-red-700">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
