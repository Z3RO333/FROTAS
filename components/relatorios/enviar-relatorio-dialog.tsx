"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  trigger: React.ReactNode;
  title: string;
  action: (formData: FormData) => Promise<void>;
};

export function EnviarRelatorioDialog({ trigger, title, action }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await action(formData);
        toast.success("Relatorio enviado");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao enviar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="destinatarios">Destinatarios</Label>
            <Input
              id="destinatarios"
              name="destinatarios"
              placeholder="ana@bemol.com.br, joao@fornecedor.com"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                "Enviando..."
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                  Enviar
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
