"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash } from "lucide-react";
import { excluirFrotaAction } from "@/app/(app)/frotas/_actions";
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

export function DeleteFrotaButton({ id, label }: { id: number; label: string }) {
  const [open, setOpen] = useState(false);
  const action = excluirFrotaAction.bind(null, id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash className="mr-2 h-4 w-4" aria-hidden="true" />
          Excluir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir frota?</DialogTitle>
          <DialogDescription>
            A frota <strong>{label}</strong> será marcada como inativa e deixará de aparecer na lista
            padrão.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <form action={action}>
            <DeleteSubmitButton />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Excluindo..." : "Confirmar"}
    </Button>
  );
}
