"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SETORES } from "@/components/sinistros/driver-sinistro-form";
import type { NotificacaoDestinatario, NotificacaoEvento } from "@/lib/repos/notificacao-destinatarios";
import { updateNotificacaoDestinatariosAction } from "./_actions";

type Row = { evento: NotificacaoEvento; chave: string | null; label: string; destinatarios: string[] };

function buildRows(destinatarios: NotificacaoDestinatario[]): Row[] {
  const byKey = new Map(destinatarios.map((d) => [`${d.evento}:${d.chave ?? ""}`, d.destinatarios]));

  return [
    { evento: "SOCORRO_GERAL" as const, chave: null, label: "Socorro — geral" },
    ...SETORES.map((setor) => ({ evento: "SOCORRO_AREA" as const, chave: setor, label: `Socorro — ${setor}` })),
    { evento: "SINISTRO_GERAL" as const, chave: null, label: "Sinistro — geral" },
  ].map((r) => ({ ...r, destinatarios: byKey.get(`${r.evento}:${r.chave ?? ""}`) ?? [] }));
}

function DestinatarioRow({ row }: { row: Row }) {
  const router = useRouter();
  const [value, setValue] = useState(row.destinatarios.join(", "));
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("destinatarios", value);
      const result = await updateNotificacaoDestinatariosAction(row.evento, row.chave, formData);
      if (result.ok) {
        toast.success(result.message ?? "Destinatários atualizados");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
      <span className="w-48 shrink-0 text-sm font-medium">{row.label}</span>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="email1@bemol.com.br, email2@bemol.com.br"
        className="min-w-64 flex-1"
      />
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={handleSave}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Salvar
      </Button>
    </div>
  );
}

export function NotificacaoDestinatariosSection({
  destinatarios,
}: {
  destinatarios: NotificacaoDestinatario[];
}) {
  const rows = buildRows(destinatarios);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Destinatários de eventos (Socorro / Sinistro)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Quem recebe o e-mail assim que um motorista registra um pedido de socorro ou um sinistro. O motorista não
          escolhe nada disso — é só o admin quem configura aqui.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <DestinatarioRow key={`${row.evento}:${row.chave ?? ""}`} row={row} />
        ))}
      </CardContent>
    </Card>
  );
}
