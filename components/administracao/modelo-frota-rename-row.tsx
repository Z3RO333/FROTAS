"use client";

import { Fragment, useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { renomearModeloAction, type RenomearModeloActionState } from "@/app/(app)/administracao/unificacoes/modelos/_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const INITIAL_STATE: RenomearModeloActionState = { ok: true, mensagem: "" };

function SaveButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{pending ? "Unificando..." : "Unificar"}</Button>;
}

export function ModeloFrotaRenameRow({ modelo, total, modelos }: { modelo: string; total: number; modelos: string[] }) {
  const suggestionsId = useId();
  const [editing, setEditing] = useState(false);
  const [nomeNovo, setNomeNovo] = useState(modelo);
  const [state, formAction] = useActionState(renomearModeloAction, INITIAL_STATE);
  const feedback = !state.ok ? state.error : state.mensagem || null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const destino = nomeNovo.trim();
    if (!destino || destino === modelo || !window.confirm(`Unificar "${modelo}" como "${destino}"? Isso altera ${total} frota(s). Se o destino já existir, os grupos serão unidos.`)) {
      event.preventDefault();
      return;
    }
    setEditing(false);
  }

  return <Fragment>
    <tr className="border-b last:border-0">
      <td className="py-2.5 pr-4">{editing ? <form action={formAction} onSubmit={handleSubmit} className="flex items-center gap-2"><input type="hidden" name="nome_atual" value={modelo} /><Input name="nome_novo" list={suggestionsId} value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Modelo padronizado" className="h-8 max-w-sm" autoFocus /><datalist id={suggestionsId}>{modelos.filter((item) => item !== modelo).map((item) => <option key={item} value={item} />)}</datalist><SaveButton /><Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setNomeNovo(modelo); }}><X className="h-4 w-4" /></Button></form> : <span className="font-medium text-slate-900">{modelo}</span>}</td>
      <td className="py-2.5 pr-4 text-right tabular-nums text-slate-600">{total}</td>
      <td className="py-2.5 text-right">{!editing && <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />Unificar</Button>}</td>
    </tr>
    {feedback && <tr className="border-b last:border-0"><td colSpan={3} className="pb-2.5 pt-0"><p className={`text-xs font-medium ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{feedback}</p></td></tr>}
  </Fragment>;
}
