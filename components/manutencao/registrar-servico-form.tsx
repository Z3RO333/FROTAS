"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CalendarCheck2, Loader2, Truck } from "lucide-react";
import {
  registrarServicoAction,
  type RegistrarServicoState,
} from "@/app/(app)/manutencao/_actions";
import type { TipoServico } from "@/lib/repos/manutencao/types";
import type { VeiculoServicoOption } from "@/lib/repos/manutencao/servicos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RetornarOperacaoDialog } from "@/components/frotas/manutencao/retornar-operacao-dialog";
import { cn } from "@/lib/utils";

const INITIAL_STATE: RegistrarServicoState = { ok: true, mensagem: "" };

const PREVENTIVAS: Array<{ value: TipoServico; label: string }> = [
  { value: "alinhamento", label: "Alinhamento" },
  { value: "motor", label: "Preventiva do motor" },
  { value: "suspensao", label: "Suspensão" },
  { value: "ar-condicionado", label: "Ar-condicionado" },
  { value: "embreagem", label: "Embreagem" },
  { value: "portas_rool_up", label: "Porta Roll-Up" },
  { value: "tacografo", label: "Tacógrafo" },
];

function SubmitButton({ label, compact = false }: { label: string; compact?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className={cn("h-10 self-end", compact ? "w-full sm:col-span-2" : "lg:col-span-2")}
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck2 className="mr-2 h-4 w-4" />}
      {pending ? "Registrando..." : label}
    </Button>
  );
}

type Props = {
  veiculos: VeiculoServicoOption[];
  today: string;
  fixedType?: TipoServico;
  serviceLabel?: string;
  selectedVehicle?: VeiculoServicoOption;
  variant?: "panel" | "dialog";
};

export function RegistrarServicoForm({
  veiculos,
  today,
  fixedType,
  serviceLabel,
  selectedVehicle,
  variant = "panel",
}: Props) {
  const [state, action] = useActionState(registrarServicoAction, INITIAL_STATE);
  const [released, setReleased] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const datalistId = useId();

  useEffect(() => {
    if (state.ok && state.mensagem) {
      formRef.current?.reset();
      setReleased(false);
    }
  }, [state]);

  const isLavagem = fixedType === "lavagem";
  const fixedLabel = serviceLabel ?? (isLavagem ? "Lavagem" : "Serviço");
  const feedback = state.ok ? state.mensagem : state.error;
  const blockedFrota = state.ok && state.bloqueouFrota && state.frotaId && state.frotaLabel && !released
    ? { id: state.frotaId, label: state.frotaLabel }
    : null;

  const content = (
    <>
      <div className="mb-4">
        {variant === "panel" && (
          <h2 className="text-base font-semibold text-slate-950">
            {fixedType ? `Enviar para ${fixedLabel.toLocaleLowerCase("pt-BR")}` : "Enviar para preventiva"}
          </h2>
        )}
        <p className="mt-0.5 text-sm text-slate-600">
          {isLavagem
            ? "Preencha os dados da lavagem. A próxima data será calculada automaticamente."
            : "Preencha os dados do serviço para colocar a frota em manutenção."}
        </p>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Ao registrar, a frota entra em manutenção e fica bloqueada para checklist e portaria.
          Retire-a da manutenção assim que o serviço terminar.
        </p>
      </div>

      <form
        ref={formRef}
        action={action}
        className={cn("grid gap-3", variant === "dialog" ? "sm:grid-cols-2" : "lg:grid-cols-12")}
      >
        {fixedType ? (
          <input type="hidden" name="tipo_servico" value={fixedType} />
        ) : (
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="tipo_servico">Preventiva *</Label>
            <select
              id="tipo_servico"
              name="tipo_servico"
              required
              defaultValue="alinhamento"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {PREVENTIVAS.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </div>
        )}

        {selectedVehicle ? (
          <div className={cn("rounded-lg border border-blue-200 bg-blue-50 p-3", variant === "dialog" ? "sm:col-span-2" : "lg:col-span-3")}>
            <input type="hidden" name="id_veiculo" value={selectedVehicle.codigo_frota} />
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
                <Truck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-medium text-blue-700">Frota selecionada</p>
                <p className="font-semibold text-slate-950">
                  {selectedVehicle.codigo_frota}
                  {selectedVehicle.placa ? <span className="ml-2 font-mono text-xs font-normal text-slate-600">{selectedVehicle.placa}</span> : null}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className={cn("space-y-1.5", variant === "dialog" ? "sm:col-span-2" : "lg:col-span-3")}>
            <Label htmlFor="id_veiculo">Frota *</Label>
            {variant === "dialog" ? (
              <select
                id="id_veiculo"
                name="id_veiculo"
                required
                defaultValue=""
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>Selecione a frota</option>
                {veiculos.map((veiculo) => (
                  <option key={veiculo.codigo_frota} value={veiculo.codigo_frota}>
                    {veiculo.codigo_frota}{veiculo.placa ? ` · ${veiculo.placa}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <Input
                  id="id_veiculo"
                  name="id_veiculo"
                  list={datalistId}
                  required
                  autoComplete="off"
                  placeholder="Digite ou selecione a frota"
                />
                <datalist id={datalistId}>
                  {veiculos.map((veiculo) => (
                    <option key={veiculo.codigo_frota} value={veiculo.codigo_frota}>
                      {veiculo.placa ?? "Sem placa"}
                    </option>
                  ))}
                </datalist>
              </>
            )}
          </div>
        )}

        <div className={cn("space-y-1.5", variant === "panel" && "lg:col-span-2")}>
          <Label htmlFor="data_servico">Data do serviço *</Label>
          <Input id="data_servico" name="data_servico" type="date" required max={today} defaultValue={today} />
        </div>

        <div className={cn("space-y-1.5", variant === "panel" && "lg:col-span-2")}>
          <Label htmlFor="quilometragem">KM</Label>
          <Input id="quilometragem" name="quilometragem" type="number" min={0} step={1} inputMode="numeric" placeholder="Opcional" />
        </div>

        <div className={cn("space-y-1.5", variant === "dialog" ? "sm:col-span-2" : "lg:col-span-3")}>
          <Label htmlFor="observacoes">Observação</Label>
          <Input id="observacoes" name="observacoes" maxLength={1000} placeholder="Opcional" />
        </div>

        <SubmitButton
          compact={variant === "dialog"}
          label={fixedType ? `Enviar para ${fixedLabel.toLocaleLowerCase("pt-BR")}` : "Enviar para preventiva"}
        />

        {blockedFrota && (
          <div role="alert" className={cn("flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between", variant === "dialog" ? "sm:col-span-2" : "lg:col-span-12")}>
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Frota {blockedFrota.label} bloqueada para manutenção.</p>
                <p className="mt-0.5 text-xs">Quando o serviço terminar, use o botão ao lado para retirá-la da manutenção e liberar a operação.</p>
              </div>
            </div>
            <RetornarOperacaoDialog
              frotaId={blockedFrota.id}
              frotaLabel={blockedFrota.label}
              size="sm"
              onSuccess={() => setReleased(true)}
            />
          </div>
        )}

        {released && (
          <div role="status" className={cn("rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800", variant === "dialog" ? "sm:col-span-2" : "lg:col-span-12")}>
            Serviço registrado e frota retornada à operação.
          </div>
        )}

        {feedback && !blockedFrota && !released && (
          <div
            role="status"
            className={`rounded-md px-3 py-2 text-sm ${variant === "dialog" ? "sm:col-span-2" : "lg:col-span-12"} ${
              state.ok
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {feedback}
          </div>
        )}
      </form>
    </>
  );

  if (variant === "dialog") return content;

  return (
    <section className="rounded-xl border border-blue-200/70 bg-gradient-to-br from-blue-50/70 to-white p-4 shadow-sm sm:p-5">
      {content}
    </section>
  );
}
