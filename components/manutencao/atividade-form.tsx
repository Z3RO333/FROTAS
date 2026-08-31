"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import type { AtividadeActionState } from "@/app/(app)/manutencao/atividades/_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VehicleSearchSelect, type VehicleOption } from "@/components/vehicles/vehicle-search-select";
import { ATIVIDADE_TIPOS, TIPO_ATIVIDADE_LABELS } from "@/lib/atividades/rules";

const INITIAL_STATE: AtividadeActionState = { error: null, values: null, attempt: 0 };

export type MotoristaInternoOption = { id: string; nome: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Send className="h-4 w-4" aria-hidden="true" />
      {pending ? "Enviando..." : "Criar atividade"}
    </Button>
  );
}

export function AtividadeForm({
  vehicles,
  motoristas,
  action,
}: {
  vehicles: VehicleOption[];
  motoristas: MotoristaInternoOption[];
  action: (state: AtividadeActionState, formData: FormData) => Promise<AtividadeActionState>;
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [frotaId, setFrotaId] = useState<number | null>(state.values?.frotaId ?? null);
  const [tipo, setTipo] = useState<string>(state.values?.tipo || "LEVAR_PARA");
  const [motoristaId, setMotoristaId] = useState<string>(state.values?.motoristaId ?? "");

  return (
    <form key={state.attempt} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="frota_id" value={frotaId ?? ""} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="motorista_id" value={motoristaId} />

      <div className="sm:col-span-2 space-y-1.5">
        <Label>Frota</Label>
        <VehicleSearchSelect vehicles={vehicles} value={frotaId} onChange={(v) => setFrotaId(v?.id ?? null)} />
      </div>

      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ATIVIDADE_TIPOS.map((t) => (
              <SelectItem key={t} value={t}>{TIPO_ATIVIDADE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Motorista</Label>
        <Select value={motoristaId} onValueChange={setMotoristaId}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {motoristas.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="local">Local</Label>
        <Input
          id="local"
          name="local"
          placeholder="Ex.: BONFIM, GALPÃO DA TS..."
          defaultValue={state.values?.local ?? ""}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observacao">Observação (opcional)</Label>
        <Input id="observacao" name="observacao" defaultValue={state.values?.observacao ?? ""} />
      </div>

      {state.error ? (
        <p className="sm:col-span-2 text-sm font-medium text-red-700">{state.error}</p>
      ) : null}

      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}
