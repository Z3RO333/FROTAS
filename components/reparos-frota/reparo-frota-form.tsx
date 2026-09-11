"use client";

import { type ReactNode, useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AlertTriangle, ChevronRight, Loader2, Send } from "lucide-react";
import { enviarReparoFrotaAction } from "@/app/(app)/reparos-frota/_actions";
import { REPARO_FROTA_INITIAL_STATE } from "@/app/(app)/reparos-frota/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Frota } from "@/lib/repos/frotas";
import { cn } from "@/lib/utils";

const PRIORIDADES = [
  { value: "NORMAL", label: "Normal", tone: "has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-800" },
  { value: "URGENTE", label: "Urgente", tone: "has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50 has-[:checked]:text-amber-800" },
  { value: "ALTA", label: "Alta", tone: "has-[:checked]:border-red-500 has-[:checked]:bg-red-50 has-[:checked]:text-red-800" },
] as const;

export function ReparoFrotaForm({ frotas, user }: { frotas: Frota[]; user: { name: string; email: string } }) {
  const router = useRouter();
  const [actionState, formAction] = useActionState(enviarReparoFrotaAction, REPARO_FROTA_INITIAL_STATE);
  const [frotaId, setFrotaId] = useState("");
  const [frotaQuery, setFrotaQuery] = useState("");
  const [placaQuery, setPlacaQuery] = useState("");
  const [frotaCarregada, setFrotaCarregada] = useState("");
  const [prioridade, setPrioridade] = useState<string>("NORMAL");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (actionState.ok) router.push(actionState.redirectTo);
  }, [actionState, router]);

  const filteredFrotas = useMemo(() => {
    const q = frotaQuery.trim().toLowerCase();
    const p = placaQuery.trim().toLowerCase();
    return frotas
      .filter((frota) => {
        if (q && !String(frota.frota_geral ?? "").toLowerCase().includes(q)) return false;
        if (p && !String(frota.placa ?? "").toLowerCase().includes(p)) return false;
        return true;
      })
      .slice(0, 50);
  }, [frotaQuery, placaQuery, frotas]);

  const selectedFrota = frotas.find((frota) => String(frota.id) === frotaId) ?? null;

  function handlePreSubmit(event: { preventDefault(): void }) {
    if (!frotaId) {
      event.preventDefault();
      setFormError("Selecione a frota/carreta.");
      return;
    }
    if (!frotaCarregada) {
      event.preventDefault();
      setFormError("Informe se a frota está carregada.");
      return;
    }
    setFormError(null);
  }

  return (
    <form action={formAction} onSubmit={handlePreSubmit} className="mx-auto max-w-3xl space-y-5">
      <input type="hidden" name="frota_id" value={frotaId} />
      <input type="hidden" name="frota_carregada" value={frotaCarregada} />

      <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
        <h1 className="text-2xl font-bold tracking-tight">Solicitar reparo de frota</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre uma solicitação de verificação/reparo para uma frota. A equipe de manutenção é notificada por
          e-mail.
        </p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Solicitante</p>
          <p className="font-semibold">{user.name}</p>
          <p className="text-sm text-muted-foreground">E-mail: {user.email}</p>
        </div>
      </div>

      {(!actionState.ok && actionState.error) || formError ? (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {formError ?? (!actionState.ok ? actionState.error : null)}
        </div>
      ) : null}

      <section className="space-y-4 rounded-md border bg-white p-4 shadow-sm">
        <div className="space-y-3">
          <div>
            <Label>Frota / Carreta *</Label>
            {selectedFrota ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Selecionada: <strong>{selectedFrota.frota_geral ?? selectedFrota.id}</strong>
                {" - "}Placa: <strong>{selectedFrota.placa ?? "-"}</strong>
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Buscar por frota" value={frotaQuery} onChange={(e) => setFrotaQuery(e.target.value)} />
            <Input placeholder="Buscar por placa" value={placaQuery} onChange={(e) => setPlacaQuery(e.target.value)} />
          </div>
          <div className="max-h-48 overflow-y-auto rounded-md border">
            {filteredFrotas.map((frota) => {
              const isSelected = String(frota.id) === frotaId;
              const indisponivel = frota.vendido || !frota.ativo;
              return (
                <button
                  key={frota.id}
                  type="button"
                  disabled={Boolean(indisponivel)}
                  onClick={() => setFrotaId(String(frota.id))}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto] gap-3 border-b p-3 text-left text-sm transition-colors last:border-0",
                    isSelected ? "bg-blue-50 text-blue-800" : "bg-white hover:bg-slate-50",
                    indisponivel && "cursor-not-allowed bg-slate-50 text-slate-400"
                  )}
                >
                  <span>
                    <span className="block font-semibold">{frota.frota_geral ?? frota.id}</span>
                    <span className="text-muted-foreground">{frota.modelo ?? "Modelo não informado"}</span>
                  </span>
                  <span className="font-medium">{frota.placa ?? "-"}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="km">KM *</Label>
            <Input id="km" name="km" type="number" inputMode="numeric" min={0} required placeholder="Ex.: 49453" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="litros">Litros</Label>
            <Input id="litros" name="litros" type="number" inputMode="decimal" min={0} step="0.01" placeholder="Ex.: 150" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="motivo_verificacao">Motivo da verificação *</Label>
          <textarea
            id="motivo_verificacao"
            name="motivo_verificacao"
            rows={4}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Descreva o problema, ex.: limpador de para-brisa sem palheta"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="localizacao">Onde está a frota *</Label>
          <Input id="localizacao" name="localizacao" required placeholder="Ex.: Pátio CD Manaus" />
        </div>

        <div className="space-y-2">
          <Label>A frota está carregada? *</Label>
          <div className="grid grid-cols-2 gap-2">
            <Choice name="_frota_carregada_ui" value="sim" checked={frotaCarregada === "sim"} onChange={setFrotaCarregada}>
              Sim
            </Choice>
            <Choice name="_frota_carregada_ui" value="nao" checked={frotaCarregada === "nao"} onChange={setFrotaCarregada}>
              Não
            </Choice>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Nível de prioridade *</Label>
          <div className="grid grid-cols-3 gap-2">
            {PRIORIDADES.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex h-11 cursor-pointer items-center justify-center rounded-md border bg-white px-3 text-sm font-medium transition-colors sm:h-10",
                  opt.tone
                )}
              >
                <input
                  type="radio"
                  name="prioridade"
                  value={opt.value}
                  checked={prioridade === opt.value}
                  onChange={() => setPrioridade(opt.value)}
                  className="sr-only"
                  required
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </section>

      <SubmitButton />
    </form>
  );
}

function Choice({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked?: boolean;
  onChange?: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex h-11 cursor-pointer items-center justify-center rounded-md border bg-white px-3 text-sm font-medium transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-800 sm:h-10"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange?.(value)}
        className="sr-only"
        required
      />
      {children}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} size="lg" className="w-full">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {pending ? "Enviando..." : "Enviar solicitação"}
      {!pending ? <ChevronRight className="h-4 w-4" /> : null}
    </Button>
  );
}
