"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Wrench } from "lucide-react";
import {
  enviarManutencaoAction,
} from "@/app/(app)/frotas/_manutencao-actions";
import type { ManutencaoActionState } from "@/app/(app)/frotas/_manutencao-actions";
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
  triggerLabel?: string;
  size?: "sm" | "default";
};

const MANUTENCAO_INITIAL_STATE: ManutencaoActionState = {
  ok: true,
  mensagem: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enviando..." : "Confirmar manutenção"}
    </Button>
  );
}

export function EnviarManutencaoDialog({
  frotaId,
  frotaLabel,
  triggerLabel = "Enviar para manutenção",
  size = "default",
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(enviarManutencaoAction, MANUTENCAO_INITIAL_STATE);

  useEffect(() => {
    if (state.ok && state.mensagem) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant="outline">
          <Wrench className="mr-1.5 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar para manutenção</DialogTitle>
          <DialogDescription>
            Frota {frotaLabel} — bloqueará checklist e portaria até retornar à operação.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="frota_id" value={frotaId} />

          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo *</Label>
            <textarea
              id="motivo"
              name="motivo"
              required
              minLength={3}
              rows={2}
              placeholder="Ex: vazamento no intercooler"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo *</Label>
              <select
                id="tipo"
                name="tipo"
                defaultValue="CORRETIVA"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="PREVENTIVA">Preventiva</option>
                <option value="CORRETIVA">Corretiva</option>
                <option value="EMERGENCIAL">Emergencial</option>
                <option value="OUTRA">Outra</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prev_retorno">Previsão de retorno</Label>
              <Input id="prev_retorno" name="prev_retorno" type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="oficina">Oficina / prestador</Label>
            <Input id="oficina" name="oficina" placeholder="Opcional" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="destino">Destino</Label>
            <select
              id="destino"
              name="destino"
              defaultValue=""
              title="Destino da manutenção"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">Selecione o destino (opcional)</option>
              <option value="OFICINA">Oficina</option>
              <option value="LAVAGEM">Lavagem</option>
              <option value="PREVENTIVA">Manutenção preventiva</option>
              <option value="CORRETIVA">Manutenção corretiva</option>
              <option value="ALINHAMENTO">Alinhamento</option>
              <option value="AR_CONDICIONADO">Ar-condicionado</option>
              <option value="TACOGRAFO">Tacógrafo</option>
              <option value="OUTRO">Outro destino</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="destino_detalhe">Detalhe do destino (opcional)</Label>
            <Input
              id="destino_detalhe"
              name="destino_detalhe"
              placeholder="Ex: Oficina Amazonas Diesel"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacao">Observação</Label>
            <textarea
              id="observacao"
              name="observacao"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 rounded-md border bg-slate-50 p-3 text-sm">
            <input type="hidden" name="bloqueia_checklist" value="false" />
            <input
              type="checkbox"
              name="bloqueia_checklist"
              value="true"
              defaultChecked
              className="h-4 w-4"
            />
            <span>
              <span className="font-medium">Bloquear checklist do motorista</span>
              <span className="ml-1 text-xs text-muted-foreground">
                (recomendado)
              </span>
            </span>
          </label>

          {!state.ok && state.error && (
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
