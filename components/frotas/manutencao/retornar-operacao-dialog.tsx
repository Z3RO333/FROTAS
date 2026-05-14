"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  retornarOperacaoAction,
  MANUTENCAO_INITIAL_STATE,
} from "@/app/(app)/frotas/_manutencao-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  frotaId: number;
  frotaLabel: string;
  size?: "sm" | "default";
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Liberando..." : "Retornar à operação"}
    </Button>
  );
}

export function RetornarOperacaoDialog({ frotaId, frotaLabel, size = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(retornarOperacaoAction, MANUTENCAO_INITIAL_STATE);
  const temBloqueios = !state.ok && state.bloqueios && state.bloqueios.length > 0;

  useEffect(() => {
    if (state.ok && state.mensagem) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size}>
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          Retornar à operação
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Retornar à operação</DialogTitle>
          <DialogDescription>
            Frota {frotaLabel} — liberará para checklist e portaria.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="frota_id" value={frotaId} />

          <div className="space-y-1.5">
            <Label htmlFor="observacao">Observação *</Label>
            <textarea
              id="observacao"
              name="observacao"
              required
              minLength={3}
              rows={2}
              placeholder="Ex: serviço de cardan finalizado, frota apta"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="km_atual">KM atual (opcional)</Label>
            <Input id="km_atual" name="km_atual" type="number" min={0} placeholder="Atualizar se houve rodagem" />
          </div>

          {temBloqueios && (
            <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Liberação bloqueada por:</p>
                  <ul className="mt-1 list-disc pl-4 text-xs">
                    {state.bloqueios!.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="hidden" name="forcar_liberacao" value="false" />
                <input
                  type="checkbox"
                  name="forcar_liberacao"
                  value="true"
                  className="h-4 w-4"
                />
                Forçar liberação mesmo com pendências (requer justificativa)
              </label>

              <div className="space-y-1.5">
                <Label htmlFor="justificativa_forcada">Justificativa da liberação forçada</Label>
                <textarea
                  id="justificativa_forcada"
                  name="justificativa_forcada"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {!state.ok && !temBloqueios && state.error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {state.error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
