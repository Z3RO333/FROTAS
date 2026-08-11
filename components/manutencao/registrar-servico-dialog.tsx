"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { TipoServico } from "@/lib/repos/manutencao/types";
import type { VeiculoServicoOption } from "@/lib/repos/manutencao/servicos";
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
  openFor: (vehicle?: VeiculoServicoOption) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  veiculos: VeiculoServicoOption[];
  today: string;
  fixedType: TipoServico;
  serviceLabel: string;
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
  const context = useMemo<DialogContextValue>(() => ({
    openFor(vehicle) {
      setSelectedVehicle(vehicle);
      setOpen(true);
    },
  }), []);

  return (
    <DialogContext.Provider value={context}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar {serviceLabel.toLocaleLowerCase("pt-BR")}</DialogTitle>
            <DialogDescription>
              {selectedVehicle
                ? `Frota ${selectedVehicle.codigo_frota}${selectedVehicle.placa ? ` · ${selectedVehicle.placa}` : ""}`
                : "Selecione a frota e informe os dados do serviço."}
            </DialogDescription>
          </DialogHeader>
          <RegistrarServicoForm
            key={`${selectedVehicle?.codigo_frota ?? "selecao"}-${open ? "aberto" : "fechado"}`}
            veiculos={veiculos}
            today={today}
            fixedType={fixedType}
            serviceLabel={serviceLabel}
            selectedVehicle={selectedVehicle}
            variant="dialog"
          />
        </DialogContent>
      </Dialog>
    </DialogContext.Provider>
  );
}

type TriggerProps = {
  children: ReactNode;
  vehicle?: VeiculoServicoOption;
  className?: string;
  ariaLabel?: string;
};

export function RegistrarServicoTrigger({
  children,
  vehicle,
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
      onClick={() => context.openFor(vehicle)}
    >
      {children}
    </button>
  );
}
