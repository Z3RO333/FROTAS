"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, Battery, Loader2, Truck } from "lucide-react";
import { useFormStatus } from "react-dom";
import {
  registrarTrocaBateriaAction,
  type RegistrarTrocaBateriaState,
} from "@/app/(app)/planejamento/bateria/_actions";
import type { BateriaRow } from "@/lib/repos/planejamento";
import type { VeiculoServicoOption } from "@/lib/repos/manutencao/servicos";
import { RetornarOperacaoDialog } from "@/components/frotas/manutencao/retornar-operacao-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const INITIAL_STATE: RegistrarTrocaBateriaState = { ok: true, mensagem: "" };

type OpenOptions = {
  vehicle?: VeiculoServicoOption;
  currentBattery?: BateriaRow;
};

const BatteryDialogContext = createContext<{ openFor: (options?: OpenOptions) => void } | null>(null);

export function RegistrarBateriaDialogProvider({
  children,
  veiculos,
  today,
}: {
  children: ReactNode;
  veiculos: VeiculoServicoOption[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<OpenOptions>({});
  const context = useMemo(() => ({
    openFor(options: OpenOptions = {}) {
      setSelection(options);
      setOpen(true);
    },
  }), []);

  return (
    <BatteryDialogContext.Provider value={context}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar troca de bateria</DialogTitle>
            <DialogDescription>
              {selection.vehicle
                ? `Frota ${selection.vehicle.codigo_frota}${selection.vehicle.placa ? ` · ${selection.vehicle.placa}` : ""}`
                : "Selecione a frota e informe os dados da nova bateria."}
            </DialogDescription>
          </DialogHeader>
          <RegistrarBateriaForm
            key={`${selection.vehicle?.codigo_frota ?? "selecao"}-${open ? "aberto" : "fechado"}`}
            veiculos={veiculos}
            today={today}
            selectedVehicle={selection.vehicle}
            currentBattery={selection.currentBattery}
          />
        </DialogContent>
      </Dialog>
    </BatteryDialogContext.Provider>
  );
}

export function RegistrarBateriaTrigger({
  children,
  vehicle,
  currentBattery,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  vehicle?: VeiculoServicoOption;
  currentBattery?: BateriaRow;
  className?: string;
  ariaLabel?: string;
}) {
  const context = useContext(BatteryDialogContext);
  if (!context) throw new Error("RegistrarBateriaTrigger deve estar dentro de RegistrarBateriaDialogProvider.");

  return (
    <button
      type="button"
      className={cn("cursor-pointer", className)}
      aria-label={ariaLabel}
      onClick={() => context.openFor({ vehicle, currentBattery })}
    >
      {children}
    </button>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:col-span-2">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Battery className="mr-2 h-4 w-4" />}
      {pending ? "Registrando troca..." : "Registrar troca e enviar para manutenção"}
    </Button>
  );
}

function RegistrarBateriaForm({
  veiculos,
  today,
  selectedVehicle,
  currentBattery,
}: {
  veiculos: VeiculoServicoOption[];
  today: string;
  selectedVehicle?: VeiculoServicoOption;
  currentBattery?: BateriaRow;
}) {
  const [state, action] = useActionState(registrarTrocaBateriaAction, INITIAL_STATE);
  const [released, setReleased] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.mensagem) setReleased(false);
  }, [state]);

  const blockedFrota = state.ok && state.bloqueouFrota && state.frotaId && state.frotaLabel && !released
    ? { id: state.frotaId, label: state.frotaLabel }
    : null;
  const feedback = state.ok ? state.mensagem : state.error;

  return (
    <>
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>A troca atualiza a garantia e coloca a frota em manutenção até a liberação do serviço.</p>
      </div>

      <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-2">
        {selectedVehicle ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 sm:col-span-2">
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bateria_id_veiculo">Frota *</Label>
            <select
              id="bateria_id_veiculo"
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
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="data_compra">Data da troca/compra *</Label>
          <Input id="data_compra" name="data_compra" type="date" required max={today} defaultValue={today} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="modelo_bateria">Novo modelo *</Label>
          <Input
            id="modelo_bateria"
            name="modelo_bateria"
            required
            maxLength={120}
            placeholder="Ex.: Moura M60GD"
            defaultValue={currentBattery?.modelo_bateria ?? ""}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="loja">Loja ou fornecedor *</Label>
          <Input
            id="loja"
            name="loja"
            required
            maxLength={160}
            placeholder="Informe onde a bateria foi comprada"
            defaultValue={currentBattery?.loja ?? ""}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="bateria_observacoes">Observação</Label>
          <Input id="bateria_observacoes" name="observacoes" maxLength={1000} placeholder="Motivo da troca, garantia, orçamento..." />
        </div>

        <SubmitButton />

        {blockedFrota && (
          <div role="alert" className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Troca registrada para a frota {blockedFrota.label}.</p>
              <p className="mt-0.5 text-xs">Quando terminar, libere a frota para retornar à operação.</p>
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
          <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:col-span-2">
            Troca registrada e frota retornada à operação.
          </div>
        )}

        {feedback && !blockedFrota && !released && (
          <div
            role="status"
            className={cn(
              "rounded-md border px-3 py-2 text-sm sm:col-span-2",
              state.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {feedback}
          </div>
        )}
      </form>
    </>
  );
}
