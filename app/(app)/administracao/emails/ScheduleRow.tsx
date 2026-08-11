// app/(app)/administracao/emails/ScheduleRow.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScheduleForm, TIPO_LABELS } from "./ScheduleForm";
import type { EmailSchedule } from "@/lib/repos/email-schedule";
import {
  updateScheduleAction,
  triggerScheduleNowAction,
  toggleScheduleAction,
  deleteScheduleAction,
  type ActionResult,
} from "./_actions";

type PendingKind = "disparar" | "toggle" | "remover" | null;

export function ScheduleRow({
  schedule,
  setoresDisponiveis = [],
}: {
  schedule: EmailSchedule;
  setoresDisponiveis?: string[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<PendingKind>(null);
  const [, startTransition] = useTransition();

  function run(kind: Exclude<PendingKind, null>, call: () => Promise<ActionResult>) {
    setPendingKind(kind);
    startTransition(async () => {
      try {
        const result = await call();
        if (result.ok) {
          if (result.message) toast.success(result.message);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro inesperado.");
      } finally {
        setPendingKind(null);
      }
    });
  }

  async function handleUpdate(formData: FormData) {
    const result = await updateScheduleAction(formData);
    if (result.ok) {
      if (result.message) toast.success(result.message);
      setEditOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleRemover() {
    if (!window.confirm(`Remover a programação "${schedule.nome}"? Essa ação não pode ser desfeita.`)) return;
    run("remover", () => deleteScheduleAction(schedule.id));
  }

  const totalDestinatarios = new Set([
    ...schedule.destinatarios,
    ...Object.values(schedule.destinatarios_por_setor ?? {}).flat(),
  ]).size;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{schedule.nome}</span>
          <Badge variant="outline">{TIPO_LABELS[schedule.tipo] ?? schedule.tipo}</Badge>
          <Badge
            variant="outline"
            className={schedule.ativo ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-500"}
          >
            {schedule.ativo ? "Ativo" : "Pausado"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {schedule.frequencia} · {schedule.hora_envio} · {totalDestinatarios} destinatário(s)
          {schedule.setores_incluidos.length > 0 ? ` · ${schedule.setores_incluidos.length} setor(es) vinculado(s)` : ""}
          {schedule.ultimo_envio
            ? ` · Último envio: ${new Date(schedule.ultimo_envio).toLocaleDateString("pt-BR")}`
            : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          Editar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pendingKind !== null}
          onClick={() => run("disparar", () => triggerScheduleNowAction(schedule.id))}
        >
          {pendingKind === "disparar" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Disparar agora
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pendingKind !== null}
          onClick={() => run("toggle", () => toggleScheduleAction(schedule.id, schedule.ativo))}
        >
          {pendingKind === "toggle" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {schedule.ativo ? "Pausar" : "Ativar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700"
          disabled={pendingKind !== null}
          onClick={handleRemover}
        >
          {pendingKind === "remover" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Remover
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar programação</DialogTitle>
          </DialogHeader>
          <ScheduleForm
            schedule={schedule}
            action={handleUpdate}
            onCancel={() => setEditOpen(false)}
            setoresDisponiveis={setoresDisponiveis}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
