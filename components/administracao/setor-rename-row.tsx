"use client";

import { Fragment, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, Pencil, X } from "lucide-react";
import {
  renomearSetorAction,
  type RenomearSetorActionState,
} from "@/app/(app)/administracao/setores/_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Fica aqui, não no arquivo "use server": um módulo de Server Actions só pode
// exportar funções assíncronas — exportar essa constante de lá derrubava a
// avaliação do módulo inteiro ("A 'use server' file can only export async
// functions, found object") e estourava a página por completo.
const RENOMEAR_SETOR_INITIAL_STATE: RenomearSetorActionState = { ok: true, mensagem: "" };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
      {pending ? "Salvando..." : "Salvar"}
    </Button>
  );
}

export function SetorRenameRow({ setor, total }: { setor: string; total: number }) {
  const [editing, setEditing] = useState(false);
  const [nomeNovo, setNomeNovo] = useState(setor);
  const [state, formAction] = useActionState(renomearSetorAction, RENOMEAR_SETOR_INITIAL_STATE);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const destino = nomeNovo.trim();
    const mensagem =
      destino && destino !== setor
        ? `Renomear "${setor}" para "${destino}"? Afeta ${total} frota(s) e as agendas de e-mail vinculadas.${
            destino !== setor ? " Se já existir um setor com esse nome, os dois se fundem." : ""
          }`
        : `Limpar o setor de ${total} frota(s) atualmente em "${setor}"?`;
    if (!window.confirm(mensagem)) {
      event.preventDefault();
      return;
    }
    setEditing(false);
  }

  const feedback = !state.ok && state.error ? state.error : state.ok && state.mensagem ? state.mensagem : null;

  return (
    <Fragment>
      <tr className="border-b last:border-0">
        <td className="py-2.5 pr-4">
          {editing ? (
            <form action={formAction} onSubmit={handleSubmit} className="flex items-center gap-2">
              <input type="hidden" name="nome_atual" value={setor} />
              <Input
                name="nome_novo"
                value={nomeNovo}
                onChange={(e) => setNomeNovo(e.target.value)}
                placeholder="Deixe em branco para limpar"
                className="h-8 max-w-xs"
                autoFocus
              />
              <SaveButton />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setNomeNovo(setor);
                }}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          ) : (
            <span className="font-medium text-slate-900">{setor}</span>
          )}
        </td>
        <td className="py-2.5 pr-4 text-right tabular-nums text-slate-600">{total}</td>
        <td className="py-2.5 text-right">
          {!editing && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Renomear
            </Button>
          )}
        </td>
      </tr>
      {feedback && (
        <tr className="border-b last:border-0">
          <td colSpan={3} className="pb-2.5 pt-0">
            <p className={`text-xs font-medium ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{feedback}</p>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
