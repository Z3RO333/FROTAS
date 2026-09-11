"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil } from "lucide-react";
import { atualizarManutencaoAction, type AtualizarManutencaoActionState } from "@/app/(app)/frotas/disponibilidades/_actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL_STATE: AtualizarManutencaoActionState = { ok: true, mensagem: "" };

function SaveButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar alterações"}</Button>;
}

export function EditarManutencaoDialog({ frotaId, frotaLabel, oficina, previsaoRetorno }: {
  frotaId: number;
  frotaLabel: string;
  oficina: string | null;
  previsaoRetorno: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(atualizarManutencaoAction, INITIAL_STATE);

  useEffect(() => {
    if (state.ok && state.mensagem) setOpen(false);
  }, [state]);

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline"><Pencil className="h-3.5 w-3.5" />Editar</Button></DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Editar manutenção</DialogTitle><DialogDescription>Atualize a oficina ou a previsão de retorno da frota {frotaLabel}.</DialogDescription></DialogHeader>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="frota_id" value={frotaId} />
        <div className="space-y-1.5"><Label htmlFor={`oficina-${frotaId}`}>Oficina / prestador</Label><Input id={`oficina-${frotaId}`} name="oficina" defaultValue={oficina ?? ""} placeholder="Informe a nova oficina" maxLength={160} /></div>
        <div className="space-y-1.5"><Label htmlFor={`previsao-${frotaId}`}>Previsão de retorno</Label><Input id={`previsao-${frotaId}`} name="prev_retorno" type="date" defaultValue={previsaoRetorno?.slice(0, 10) ?? ""} /></div>
        {!state.ok && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><SaveButton /></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
