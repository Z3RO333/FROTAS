"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Frota } from "@/lib/repos/frotas";

type Props = {
  initial?: Partial<Frota>;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
};

export function FrotaForm({ initial, action, submitLabel }: Props) {
  return (
    <form action={action} className="grid max-w-3xl gap-4 md:grid-cols-2">
      <Field label="Frota geral" name="frota_geral" defaultValue={initial?.frota_geral ?? ""} />
      <Field label="Placa" name="placa" defaultValue={initial?.placa ?? ""} />
      <Field label="Modelo / Marca *" name="modelo" required defaultValue={initial?.modelo ?? ""} />
      <Field
        label="Chassi"
        name="chassi"
        placeholder="SEM INFORMAÇÕES - preencha quando souber"
        defaultValue={initial?.chassi ?? ""}
        disabled={Boolean(initial?.id && initial.chassi)}
      />
      <Field label="Renavam" name="renavam" defaultValue={initial?.renavam ?? ""} />
      <Field
        label="Ano de fabricação"
        name="ano_fabricacao"
        type="number"
        defaultValue={initial?.ano_fabricacao ?? ""}
      />
      <Field label="Localização" name="localizacao" defaultValue={initial?.localizacao ?? ""} />
      <Field label="Km atual" name="km_atual" type="number" defaultValue={initial?.km_atual ?? ""} />

      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="observacoes">Observações</Label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={4}
          defaultValue={initial?.observacoes ?? ""}
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
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...rest} />
    </div>
  );
}
