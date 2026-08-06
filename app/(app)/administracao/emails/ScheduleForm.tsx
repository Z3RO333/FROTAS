// app/(app)/administracao/emails/ScheduleForm.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmailSchedule } from "@/lib/repos/email-schedule";

const TIPO_LABELS: Record<string, string> = {
  DISPONIBILIDADE: "Disponibilidade",
  PREVENTIVAS_ATRASO: "Preventivas em atraso",
  LAVAGEM_PENDENTE: "Lavagem pendente",
  TACOGRAFO_VENCIDO: "Tacógrafo vencido",
  FROTAS_PARADAS: "Frotas paradas",
  CUSTOS: "Custos",
  ALERTAS: "Alertas operacionais",
  RELATORIO_DIARIO_IA: "Relatório diário IA",
  RELATORIO_OPERACIONAL_DIARIO: "Relatório operacional diário",
};

type ScheduleFormProps = {
  schedule?: EmailSchedule;
  action: (formData: FormData) => void | Promise<void>;
};

export function ScheduleForm({ schedule, action }: ScheduleFormProps) {
  const [frequencia, setFrequencia] = useState<string>(schedule?.frequencia ?? "DIARIO");
  const isEdit = Boolean(schedule);

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isEdit ? "Editar programação" : "Nova programação"}</h2>
        {isEdit && (
          <a href="/administracao/emails" className="text-sm text-muted-foreground hover:underline">
            Cancelar
          </a>
        )}
      </div>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        {isEdit && <input type="hidden" name="id" value={schedule!.id} />}
        <div className="space-y-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            name="nome"
            placeholder="Ex: Relatório semanal de disponibilidade"
            defaultValue={schedule?.nome}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tipo">Tipo de relatório</Label>
          <select
            id="tipo"
            name="tipo"
            required
            defaultValue={schedule?.tipo}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {Object.entries(TIPO_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="destinatarios">Destinatários (separados por vírgula)</Label>
          <Input
            id="destinatarios"
            name="destinatarios"
            placeholder="email1@bemol.com.br, email2@bemol.com.br"
            defaultValue={schedule?.destinatarios.join(", ")}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="frequencia">Frequência</Label>
          <select
            id="frequencia"
            name="frequencia"
            value={frequencia}
            onChange={(e) => setFrequencia(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="DIARIO">Diário</option>
            <option value="SEMANAL">Semanal</option>
            <option value="QUINZENAL">Quinzenal</option>
            <option value="MENSAL">Mensal</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hora_envio">Horário</Label>
          <Input
            id="hora_envio"
            name="hora_envio"
            type="time"
            defaultValue={schedule?.hora_envio?.slice(0, 5) ?? "07:00"}
            required
          />
        </div>
        {frequencia === "SEMANAL" && (
          <div className="space-y-1.5">
            <Label htmlFor="dia_semana">Dia da semana</Label>
            <select
              id="dia_semana"
              name="dia_semana"
              defaultValue={String(schedule?.dia_semana ?? 1)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="0">Domingo</option><option value="1">Segunda-feira</option><option value="2">Terça-feira</option>
              <option value="3">Quarta-feira</option><option value="4">Quinta-feira</option><option value="5">Sexta-feira</option><option value="6">Sábado</option>
            </select>
          </div>
        )}
        {frequencia === "MENSAL" && (
          <div className="space-y-1.5">
            <Label htmlFor="dia_mes">Dia do mês</Label>
            <Input
              id="dia_mes"
              name="dia_mes"
              type="number"
              min={1}
              max={31}
              defaultValue={schedule?.dia_mes ?? 1}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="cds_incluidos">CDs incluídos (vazio = todos)</Label>
          <Input
            id="cds_incluidos"
            name="cds_incluidos"
            placeholder="CD Manaus, CD Boa Vista"
            defaultValue={schedule?.cds_incluidos.join(", ")}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">{isEdit ? "Salvar alterações" : "Criar programação"}</Button>
        </div>
      </form>
    </div>
  );
}
