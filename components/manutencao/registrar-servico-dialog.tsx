"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { TipoServico } from "@/lib/repos/manutencao/types";
import type { VeiculoServicoOption } from "@/lib/repos/manutencao/servicos";
import { SERVICE_CATALOG } from "@/lib/manutencao-service-catalog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RegistrarServicoForm } from "@/components/manutencao/registrar-servico-form";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  openFor: (vehicle?: VeiculoServicoOption, tipoServico?: TipoServico) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  veiculos: VeiculoServicoOption[];
  today: string;
  /** Tipo padrão do formulário quando o gatilho não escolhe um específico (ex: página de um único serviço). */
  fixedType?: TipoServico;
  /** Rótulo padrão; ignorado quando o gatilho passa um tipoServico próprio (o rótulo vem de SERVICE_CATALOG). */
  serviceLabel?: string;
};

export function RegistrarServicoDialogProvider({
  children,
  veiculos,
  today,
  fixedType,
  serviceLabel,
}: ProviderProps) {
  const [open, setOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VeiculoServicoOption>();
  const [selectedTipo, setSelectedTipo] = useState<TipoServico | undefined>(fixedType);
  const context = useMemo<DialogContextValue>(() => ({
    openFor(vehicle, tipoServico) {
      setSelectedVehicle(vehicle);
      setSelectedTipo(tipoServico ?? fixedType);
      setOpen(true);
    },
  }), [fixedType]);

  const tipoAtivo = selectedTipo ?? fixedType;
  const labelAtiva = SERVICE_CATALOG.find((s) => s.type === tipoAtivo)?.label ?? serviceLabel ?? "serviço";

  return (
    <DialogContext.Provider value={context}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar {labelAtiva.toLocaleLowerCase("pt-BR")}</DialogTitle>
            <DialogDescription>
              {selectedVehicle
                ? `Frota ${selectedVehicle.codigo_frota}${selectedVehicle.placa ? ` · ${selectedVehicle.placa}` : ""}`
                : "Selecione a frota e informe os dados do serviço."}
            </DialogDescription>
          </DialogHeader>
          {tipoAtivo && (
            <RegistrarServicoForm
              key={`${selectedVehicle?.codigo_frota ?? "selecao"}-${tipoAtivo}-${open ? "aberto" : "fechado"}`}
              veiculos={veiculos}
              today={today}
              fixedType={tipoAtivo}
              serviceLabel={labelAtiva}
              selectedVehicle={selectedVehicle}
              variant="dialog"
            />
          )}
        </DialogContent>
      </Dialog>
    </DialogContext.Provider>
  );
}

type TriggerProps = {
  children: ReactNode;
  vehicle?: VeiculoServicoOption;
  /** Sobrepõe o tipo padrão do provider — use quando o mesmo provider serve linhas de tipos diferentes. */
  tipoServico?: TipoServico;
  className?: string;
  ariaLabel?: string;
};

export function RegistrarServicoTrigger({
  children,
  vehicle,
  tipoServico,
  className,
  ariaLabel,
}: TriggerProps) {
  const context = useContext(DialogContext);
  if (!context) throw new Error("RegistrarServicoTrigger deve estar dentro de RegistrarServicoDialogProvider.");

  return (
    <button
      type="button"
      className={cn("cursor-pointer", className)}
      aria-label={ariaLabel}
      onClick={() => context.openFor(vehicle, tipoServico)}
    >
      {children}
    </button>
  );
}
