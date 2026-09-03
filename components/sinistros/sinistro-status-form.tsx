"use client";

import { useActionState } from "react";
import { atualizarStatusSinistroAction } from "@/app/(app)/sinistros/_actions";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "RESOLVIDO", label: "Resolvido" },
  { value: "CANCELADO", label: "Cancelado" },
];

export function SinistroStatusForm({ sinistroId, currentStatus }: { sinistroId: number; currentStatus: string }) {
  const [state, formAction, pending] = useActionState(atualizarStatusSinistroAction, { ok: false, error: null });

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-md border bg-slate-50 p-3">
      <input type="hidden" name="sinistro_id" value={sinistroId} />
      <div className="space-y-1">
        <label htmlFor={`status-sinistro-${sinistroId}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Atualizar status
        </label>
        <select
          id={`status-sinistro-${sinistroId}`}
          name="novo_status"
          defaultValue={currentStatus}
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Atualizando..." : "Atualizar"}
      </Button>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">Atualizado!</p> : null}
    </form>
  );
}
