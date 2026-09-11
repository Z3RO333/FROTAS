"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, ShoppingCart, Undo2 } from "lucide-react";
import {
  desfazerVendaAction,
  excluirFrotaAction,
  marcarVendidaAction,
  reativarFrotaAction,
} from "@/app/(app)/frotas/_actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function ConfirmSubmitButton({ label, pendingLabel, variant = "default" as const }: {
  label: string;
  pendingLabel: string;
  variant?: "default" | "destructive" | "outline";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function ConfirmDialog({
  trigger,
  title,
  description,
  action,
  confirmLabel,
  confirmPendingLabel,
  confirmVariant = "default" as const,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  action: () => Promise<void>;
  confirmLabel: string;
  confirmPendingLabel: string;
  confirmVariant?: "default" | "destructive" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <form action={action}>
            <ConfirmSubmitButton label={confirmLabel} pendingLabel={confirmPendingLabel} variant={confirmVariant} />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Ações de ciclo de vida da frota: ocultar/reativar e marcar/desfazer venda.
 * Cada ação tem sua contraparte de desfazer — "ocultar" e "marcar vendida"
 * nunca eram becos sem volta na intenção original ("pode ser reativada
 * futuramente", já dizia o texto do botão de ocultar), só faltava a UI.
 */
export function FrotaStatusActions({
  id,
  label,
  ativo,
  vendido,
  returnTo,
}: {
  id: number;
  label: string;
  ativo: boolean;
  vendido: boolean;
  returnTo?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {vendido ? (
        <ConfirmDialog
          trigger={
            <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
              <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Desfazer venda
            </Button>
          }
          title="Desfazer venda?"
          description={
            <>
              A frota <strong>{label}</strong> volta a aparecer como ativa (se não estiver oculta) e some da
              lista de vendidas.
            </>
          }
          action={desfazerVendaAction.bind(null, id, returnTo)}
          confirmLabel="Confirmar"
          confirmPendingLabel="Desfazendo..."
        />
      ) : (
        <ConfirmDialog
          trigger={
            <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
              <ShoppingCart className="mr-2 h-4 w-4" aria-hidden="true" />
              Marcar como vendida
            </Button>
          }
          title="Marcar frota como vendida?"
          description={
            <>
              A frota <strong>{label}</strong> deixa de aparecer na lista principal e passa a constar em{" "}
              <strong>Frotas vendidas</strong>. Pode ser desfeito depois.
            </>
          }
          action={marcarVendidaAction.bind(null, id, returnTo)}
          confirmLabel="Confirmar"
          confirmPendingLabel="Marcando..."
        />
      )}

      {ativo ? (
        <ConfirmDialog
          trigger={
            <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
              <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" />
              Ocultar frota
            </Button>
          }
          title="Ocultar frota?"
          description={
            <>
              A frota <strong>{label}</strong> será marcada como inativa e deixará de aparecer na lista.
              O histórico é preservado e ela pode ser reativada em <strong>Frotas ocultas</strong>.
            </>
          }
          action={excluirFrotaAction.bind(null, id, returnTo)}
          confirmLabel="Confirmar"
          confirmPendingLabel="Ocultando..."
          confirmVariant="destructive"
        />
      ) : (
        <ConfirmDialog
          trigger={
            <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
              <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
              Reativar frota
            </Button>
          }
          title="Reativar frota?"
          description={
            <>
              A frota <strong>{label}</strong> volta a aparecer na lista principal e nos formulários
              operacionais.
            </>
          }
          action={reativarFrotaAction.bind(null, id, returnTo)}
          confirmLabel="Confirmar"
          confirmPendingLabel="Reativando..."
        />
      )}
    </div>
  );
}
