"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmailSchedule } from "@/lib/repos/email-schedule";
import { CDS_OPERACIONAIS } from "@/lib/cds";

export const TIPO_LABELS: Record<string, string> = {
  DISPONIBILIDADE: "Disponibilidade",
  PREVENTIVAS_ATRASO: "Preventivas em atraso",
  LAVAGEM_PENDENTE: "Lavagem pendente",
  TACOGRAFO_VENCIDO: "Tacógrafo vencido",
  FROTAS_PARADAS: "Frotas paradas",
  CUSTOS: "Custos",
  ALERTAS: "Alertas operacionais",
  RELATORIO_DIARIO_IA: "Relatório diário IA",
  RELATORIO_OPERACIONAL_DIARIO: "Relatório Checklist Diário",
};

type ScheduleFormProps = {
  schedule?: EmailSchedule;
  action: (formData: FormData) => void | Promise<void>;
  onCancel?: () => void;
  setoresDisponiveis?: string[];
  frotasPorCd?: Record<string, { total: number; amostra: string[] }>;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : label}
    </Button>
  );
}

export function ScheduleForm({ schedule, action, onCancel, setoresDisponiveis = [], frotasPorCd = {} }: ScheduleFormProps) {
  const [frequencia, setFrequencia] = useState<string>(schedule?.frequencia ?? "DIARIO");
  const [tipo, setTipo] = useState<string>(schedule?.tipo ?? "DISPONIBILIDADE");
  const [setoresSelecionados, setSetoresSelecionados] = useState(
    () => new Set(schedule?.setores_incluidos ?? [])
  );
  const [cdsSelecionados, setCdsSelecionados] = useState(
    () => new Set(schedule?.cds_incluidos ?? [])
  );
  const [emailsPorSetor, setEmailsPorSetor] = useState<Record<string, string>>(() =>
    Object.fromEntries((schedule?.setores_incluidos ?? []).map((setor) => [
      setor,
      schedule?.destinatarios_por_setor?.[setor]?.join(", ") ?? schedule?.destinatarios.join(", ") ?? "",
    ]))
  );
  const isEdit = Boolean(schedule);
  const isRelatorioSetorizado = tipo === "RELATORIO_OPERACIONAL_DIARIO";

  return (
    <div className={onCancel ? "" : "rounded-lg border bg-card p-6 shadow-sm"}>
      {!onCancel && (
        <div className="mb-5 space-y-1">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Nova programação</h2>
          <p className="text-sm text-muted-foreground">Crie uma rotina de envio automático de relatórios por e-mail.</p>
        </div>
      )}
      <form action={action} className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {isEdit && <input type="hidden" name="id" value={schedule!.id} />}

        <div className="space-y-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" placeholder="Ex: Relatório semanal de disponibilidade" defaultValue={schedule?.nome} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tipo">Tipo de relatório</Label>
          <select
            id="tipo"
            name="tipo"
            required
            value={tipo}
            onChange={(event) => setTipo(event.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {Object.entries(TIPO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="destinatarios">Destinatários gerais (separados por vírgula)</Label>
          <Input
            id="destinatarios"
            name="destinatarios"
            placeholder="email1@bemol.com.br, email2@bemol.com.br"
            defaultValue={schedule?.destinatarios.join(", ")}
            required={!isRelatorioSetorizado || setoresSelecionados.size === 0}
          />
          <p className="text-xs text-muted-foreground">
            {isRelatorioSetorizado
              ? "Usados no relatório geral, quando nenhum setor for selecionado."
              : "Recebem esta programação de e-mail."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="frequencia">Frequência</Label>
          <select
            id="frequencia"
            name="frequencia"
            value={frequencia}
            onChange={(event) => setFrequencia(event.target.value)}
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
          <Input id="hora_envio" name="hora_envio" type="time" defaultValue={schedule?.hora_envio?.slice(0, 5) ?? "07:00"} required />
        </div>

        {frequencia === "SEMANAL" && (
          <div className="space-y-1.5">
            <Label htmlFor="dia_semana">Dia da semana</Label>
            <select id="dia_semana" name="dia_semana" defaultValue={String(schedule?.dia_semana ?? 1)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm">
              <option value="0">Domingo</option><option value="1">Segunda-feira</option><option value="2">Terça-feira</option>
              <option value="3">Quarta-feira</option><option value="4">Quinta-feira</option><option value="5">Sexta-feira</option><option value="6">Sábado</option>
            </select>
          </div>
        )}

        {frequencia === "MENSAL" && (
          <div className="space-y-1.5">
            <Label htmlFor="dia_mes">Dia do mês</Label>
            <Input id="dia_mes" name="dia_mes" type="number" min={1} max={31} defaultValue={schedule?.dia_mes ?? 1} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>CDs incluídos (vazio = todos)</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-input bg-background px-3 py-2">
            {CDS_OPERACIONAIS.map((cd) => (
              <label key={cd} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="cds_incluidos"
                  value={cd}
                  checked={cdsSelecionados.has(cd)}
                  onChange={(event) => {
                    setCdsSelecionados((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(cd);
                      else next.delete(cd);
                      return next;
                    });
                  }}
                  className="h-4 w-4 rounded border-input"
                />
                {cd}
              </label>
            ))}
          </div>
          {cdsSelecionados.size > 0 && (
            <div className="space-y-1 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-slate-600">
              {Array.from(cdsSelecionados).map((cd) => {
                const info = frotasPorCd[cd];
                if (!info || info.total === 0) {
                  return (
                    <p key={cd}>
                      <span className="font-medium text-slate-700">{cd}:</span> nenhuma frota encontrada.
                    </p>
                  );
                }
                const restante = info.total - info.amostra.length;
                return (
                  <p key={cd}>
                    <span className="font-medium text-slate-700">{cd}:</span> {info.total} frota(s) — {info.amostra.join(", ")}
                    {restante > 0 ? ` +${restante}` : ""}
                  </p>
                );
              })}
            </div>
          )}
        </div>

        {isRelatorioSetorizado && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Destinatários por setor</Label>
            <p className="text-xs text-muted-foreground">
              Marque o setor e informe ao lado quem receberá exclusivamente o relatório daquele setor.
              Deixe todos desmarcados para enviar um relatório geral aos destinatários acima.
            </p>
            {setoresDisponiveis.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum setor cadastrado nas frotas ainda.</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border bg-slate-50/60 p-3">
                {setoresDisponiveis.map((setor) => {
                  const checked = setoresSelecionados.has(setor);
                  return (
                    <div
                      key={setor}
                      className={`grid gap-2 rounded-lg border p-3 transition-colors sm:grid-cols-[minmax(180px,.8fr)_minmax(260px,1.2fr)] sm:items-center ${
                        checked ? "border-blue-200 bg-blue-50/70" : "border-slate-200 bg-white"
                      }`}
                    >
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          name="setores_incluidos"
                          value={setor}
                          checked={checked}
                          onChange={(event) => {
                            setSetoresSelecionados((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(setor);
                              else next.delete(setor);
                              return next;
                            });
                          }}
                          className="h-4 w-4 rounded border-input"
                        />
                        {setor}
                      </label>
                      {checked ? (
                        <div className="relative">
                          <input type="hidden" name="setor_nome" value={setor} />
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />
                          <Input
                            name="setor_destinatarios"
                            type="text"
                            inputMode="email"
                            required
                            value={emailsPorSetor[setor] ?? ""}
                            onChange={(event) => setEmailsPorSetor((current) => ({ ...current, [setor]: event.target.value }))}
                            placeholder={`E-mail(s) de ${setor}`}
                            aria-label={`Destinatários do setor ${setor}`}
                            className="bg-white pl-9"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Marque o setor para vincular o e-mail.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 sm:col-span-2">
          <SubmitButton label={isEdit ? "Salvar alterações" : "Criar programação"} />
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>}
        </div>
      </form>
    </div>
  );
}
