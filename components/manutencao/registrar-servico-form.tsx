"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CalendarCheck2, Loader2 } from "lucide-react";
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

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-10 self-end lg:col-span-2">
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
};

export function RegistrarServicoForm({ veiculos, today, fixedType, serviceLabel }: Props) {
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

  return (
    <section className="rounded-xl border border-blue-200/70 bg-gradient-to-br from-blue-50/70 to-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-950">
          {fixedType ? `Enviar para ${fixedLabel.toLocaleLowerCase("pt-BR")}` : "Enviar para preventiva"}
        </h2>
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

      <form ref={formRef} action={action} className="grid gap-3 lg:grid-cols-12">
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

        <div className="space-y-1.5 lg:col-span-3">
          <Label htmlFor="id_veiculo">Frota *</Label>
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
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="data_servico">Data do serviço *</Label>
          <Input id="data_servico" name="data_servico" type="date" required max={today} defaultValue={today} />
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="quilometragem">KM</Label>
          <Input id="quilometragem" name="quilometragem" type="number" min={0} step={1} inputMode="numeric" placeholder="Opcional" />
        </div>

        <div className="space-y-1.5 lg:col-span-3">
          <Label htmlFor="observacoes">Observação</Label>
          <Input id="observacoes" name="observacoes" maxLength={1000} placeholder="Opcional" />
        </div>

        <SubmitButton label={fixedType ? `Enviar para ${fixedLabel.toLocaleLowerCase("pt-BR")}` : "Enviar para preventiva"} />

        {blockedFrota && (
          <div role="alert" className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 lg:col-span-12 sm:flex-row sm:items-center sm:justify-between">
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
          <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 lg:col-span-12">
            Serviço registrado e frota retornada à operação.
          </div>
        )}

        {feedback && !blockedFrota && !released && (
          <div
            role="status"
            className={`rounded-md px-3 py-2 text-sm lg:col-span-12 ${
              state.ok
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {feedback}
          </div>
        )}
      </form>
    </section>
  );
}
