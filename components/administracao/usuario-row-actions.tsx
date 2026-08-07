"use client";

import { useRef, useState, type MouseEvent } from "react";
import { KeyRound, Save, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UsuarioAuditoriaDialog } from "./usuario-auditoria-dialog";
import { deleteUsuarioAction, redefinirSenhaTerceiroAction } from "@/app/(app)/administracao/usuarios/_actions";

type Props = {
  usuarioId: string;
  usuarioLabel: string;
  /** Status atual do usuário (true = ativo). */
  wasActive: boolean;
  disabled?: boolean;
  tipoConta?: "INTERNO" | "TERCEIRO";
  /** Esconde o botão de excluir pro próprio usuário logado. */
  isSelf?: boolean;
};

export function UsuarioRowActions({ usuarioId, usuarioLabel, wasActive, disabled, tipoConta, isSelf }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [senhaOpen, setSenhaOpen] = useState(false);
  const [excluirOpen, setExcluirOpen] = useState(false);
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

      {tipoConta === "TERCEIRO" && (
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setSenhaOpen(true)}>
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          <span className="ml-1.5 hidden sm:inline">Redefinir senha</span>
        </Button>
      )}

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

      {!isSelf && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="text-red-600 hover:text-red-700"
          onClick={() => setExcluirOpen(true)}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span className="ml-1.5 hidden sm:inline">Excluir</span>
        </Button>
      )}

      <Dialog open={excluirOpen} onOpenChange={setExcluirOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base">Excluir usuário?</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-sm">
              Isso apaga <span className="font-medium text-slate-900">{usuarioLabel}</span> e todo o histórico de
              auditoria dele permanentemente — não é o mesmo que desativar, e{" "}
              <span className="font-semibold">não dá pra desfazer</span>. Se só quer bloquear o acesso por
              enquanto, desative em vez de excluir.
            </DialogDescription>
          </DialogHeader>
          <form action={deleteUsuarioAction}>
            <input type="hidden" name="id" value={usuarioId} />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setExcluirOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive">
                Sim, excluir permanentemente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={senhaOpen} onOpenChange={setSenhaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Redefinir senha</DialogTitle>
            <DialogDescription className="pt-1 text-sm">
              Nova senha de acesso pra <span className="font-medium text-slate-900">{usuarioLabel}</span>.
            </DialogDescription>
          </DialogHeader>
          <form action={redefinirSenhaTerceiroAction} className="space-y-3" onSubmit={() => setSenhaOpen(false)}>
            <input type="hidden" name="id" value={usuarioId} />
            <div className="space-y-1.5">
              <Label htmlFor={`senha-${usuarioId}`}>Nova senha</Label>
              <Input id={`senha-${usuarioId}`} name="senha" type="password" minLength={8} required autoComplete="new-password" />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setSenhaOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar nova senha</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
