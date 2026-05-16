"use client";

import { useRef, useState, type MouseEvent } from "react";
import { Save, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UsuarioAuditoriaDialog } from "./usuario-auditoria-dialog";

type Props = {
  usuarioId: string;
  usuarioLabel: string;
  /** Status atual do usuário (true = ativo). */
  wasActive: boolean;
  disabled?: boolean;
};

export function UsuarioRowActions({ usuarioId, usuarioLabel, wasActive, disabled }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  function handleSaveClick(event: MouseEvent<HTMLButtonElement>) {
    if (disabled) return;
    const form = event.currentTarget.form;
    if (!form) return;
    formRef.current = form;

    let willBeActive = false;
    const ativoNodes = form.elements.namedItem("ativo");
    if (ativoNodes instanceof RadioNodeList) {
      for (const el of Array.from(ativoNodes)) {
        if (el instanceof HTMLInputElement && el.type === "checkbox") {
          willBeActive = el.checked;
        }
      }
    } else if (ativoNodes instanceof HTMLInputElement && ativoNodes.type === "checkbox") {
      willBeActive = ativoNodes.checked;
    }

    if (wasActive && !willBeActive) {
      event.preventDefault();
      setConfirmOpen(true);
    }
  }

  function confirmDeactivate() {
    setConfirmOpen(false);
    setSubmitting(true);
    // requestSubmit() dispara o submit do form sem reinvocar onClick do botão
    formRef.current?.requestSubmit();
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <UsuarioAuditoriaDialog usuarioId={usuarioId} usuarioLabel={usuarioLabel} />

      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={disabled || submitting}
        onClick={handleSaveClick}
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        <span className="ml-1.5">Salvar</span>
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600">
                <ShieldOff className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base">Desativar usuário?</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-sm">
              <span className="font-medium text-slate-900">{usuarioLabel}</span> não poderá mais acessar
              o sistema até que seja reativado. O histórico de ações fica preservado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDeactivate}>
              Sim, desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
