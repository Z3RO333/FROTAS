"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AlertTriangle } from "lucide-react";
import type { FrotaActionState } from "@/app/(app)/frotas/_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NOME_LAYOUT_PNEUS, TIPO_POR_QTD_PNEUS } from "@/lib/pneus-layout";
import type { Frota } from "@/lib/repos/frotas";
import { CDS_OPERACIONAIS } from "@/lib/cds";
import { normalizeCdNome } from "@/lib/cd-utils";

const OPCOES_QTD_PNEUS = Object.entries(TIPO_POR_QTD_PNEUS)
  .map(([qtd, tipo]) => ({ qtd: Number(qtd), label: NOME_LAYOUT_PNEUS[tipo] }))
  .sort((a, b) => a.qtd - b.qtd);

const FROTA_ACTION_INITIAL_STATE: FrotaActionState = {
  error: null,
  values: {},
  attempt: 0,
};

type Props = {
  initial?: Partial<Frota>;
  action: (state: FrotaActionState, formData: FormData) => Promise<FrotaActionState>;
  submitLabel: string;
  setores: string[];
};

export function FrotaForm({ initial, action, submitLabel, setores }: Props) {
  const [state, formAction] = useActionState(action, FROTA_ACTION_INITIAL_STATE);
  const isCreate = !initial?.id;
  const value = (name: string, fallback: React.InputHTMLAttributes<HTMLInputElement>["defaultValue"]) =>
    state.values[name] ?? fallback;
  const localizacaoLegada = initial?.localizacao?.trim() ?? "";
  const cdNormalizado = normalizeCdNome(localizacaoLegada);
  const localizacaoInicial = CDS_OPERACIONAIS.includes(cdNormalizado as (typeof CDS_OPERACIONAIS)[number])
    ? cdNormalizado
    : "";
  const setorLegado = localizacaoLegada && !CDS_OPERACIONAIS.includes(localizacaoLegada as (typeof CDS_OPERACIONAIS)[number])
    ? localizacaoLegada
    : "";
  const localizacaoAtual = String(value("localizacao", localizacaoInicial));
  const setorAtual = String(value("setor", initial?.setor ?? setorLegado));
  const opcoesLocalizacoes = [...CDS_OPERACIONAIS];
  const opcoesSetores = [...new Set(setorAtual ? [setorAtual, ...setores] : setores)];

  return (
    <form key={state.attempt} action={formAction} className="grid max-w-3xl gap-4 md:grid-cols-2">
      {state.error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 md:col-span-2" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Não foi possível salvar a frota</p>
            <p>{state.error}</p>
          </div>
        </div>
      ) : null}
      <Field label="Frota geral" name="frota_geral" defaultValue={value("frota_geral", initial?.frota_geral ?? "")} invalid={state.field === "frota_geral"} />
      <Field label="Placa" name="placa" defaultValue={value("placa", initial?.placa ?? "")} invalid={state.field === "placa"} />
      <Field label="Modelo / Marca *" name="modelo" required defaultValue={value("modelo", initial?.modelo ?? "")} invalid={state.field === "modelo"} />
      <Field
        label="Chassi"
        name="chassi"
        placeholder="SEM INFORMAÇÕES - preencha quando souber"
        defaultValue={value("chassi", initial?.chassi ?? "")}
        invalid={state.field === "chassi"}
        disabled={Boolean(initial?.id && initial.chassi)}
      />
      <Field label="Renavam" name="renavam" defaultValue={value("renavam", initial?.renavam ?? "")} invalid={state.field === "renavam"} />
      <Field
        label="Ano de fabricação"
        name="ano_fabricacao"
        type="number"
        defaultValue={value("ano_fabricacao", initial?.ano_fabricacao ?? "")}
        invalid={state.field === "ano_fabricacao"}
      />
      <div className="space-y-1.5">
        <Label htmlFor="localizacao">CD</Label>
        <select
          id="localizacao"
          name="localizacao"
          aria-label="Centro de distribuição"
          defaultValue={localizacaoAtual}
          aria-invalid={state.field === "localizacao" || undefined}
          className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            state.field === "localizacao" ? "border-red-400 focus-visible:ring-red-500" : "border-input"
          }`}
        >
          <option value="">Selecione...</option>
          {opcoesLocalizacoes.map((localizacao) => (
            <option key={localizacao} value={localizacao}>
              {localizacao}
            </option>
          ))}
        </select>
      </div>
      <Field label="Km atual" name="km_atual" type="number" defaultValue={value("km_atual", initial?.km_atual ?? "")} invalid={state.field === "km_atual"} />

      <div className="space-y-1.5">
        <Label htmlFor="setor">Setor</Label>
        <Input
          id="setor"
          name="setor"
          list="setores-frota"
          defaultValue={setorAtual}
          placeholder="Ex: Transporte, Oficina, Expedição"
          aria-invalid={state.field === "setor" || undefined}
          className={state.field === "setor" ? "border-red-400 focus-visible:ring-red-500" : undefined}
        />
        <datalist id="setores-frota">
          {opcoesSetores.map((setor) => <option key={setor} value={setor} />)}
        </datalist>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="qtd_pneus">Quantidade de pneus{isCreate ? " *" : ""}</Label>
        <select
          id="qtd_pneus"
          name="qtd_pneus"
          aria-label="Quantidade de pneus"
          required={isCreate}
          defaultValue={state.values.qtd_pneus ?? initial?.qtd_pneus ?? ""}
          aria-invalid={state.field === "qtd_pneus" || undefined}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Selecione...</option>
          {OPCOES_QTD_PNEUS.map((opcao) => (
            <option key={opcao.qtd} value={opcao.qtd}>
              {opcao.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="observacoes">Observações</Label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={4}
          defaultValue={state.values.observacoes ?? initial?.observacoes ?? ""}
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="flex gap-2 md:col-span-2">
        <SubmitButton label={submitLabel} />
        <Button type="button" variant="outline" asChild>
          <Link href={initial?.id ? `/frotas/${initial.id}` : "/frotas"}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

function Field({
  label,
  name,
  invalid,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; invalid?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} aria-invalid={invalid || undefined} className={invalid ? "border-red-400 focus-visible:ring-red-500" : undefined} {...rest} />
    </div>
  );
}
