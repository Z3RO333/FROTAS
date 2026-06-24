"use client";

import { type ChangeEvent, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Camera, ChevronRight, Loader2, MapPin, Send } from "lucide-react";
import { enviarSinistroMotoristaAction } from "@/app/(app)/motorista/sinistro/_actions";
import { SINISTRO_MOTORISTA_INITIAL_STATE } from "@/app/(app)/motorista/sinistro/types";
import { SETORES } from "@/components/sinistros/driver-sinistro-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SocorroForm({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const [actionState, formAction] = useActionState(
    enviarSinistroMotoristaAction,
    SINISTRO_MOTORISTA_INITIAL_STATE
  );
  const [locationLoading, setLocationLoading] = useState(false);
  const [endereco, setEndereco] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [precisaGuincho, setPrecisaGuincho] = useState("");
  const [mediaCount, setMediaCount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (actionState.ok) router.push(actionState.redirectTo);
  }, [actionState, router]);

  async function getLocation() {
    setFormError(null);
    if (!navigator.geolocation) {
      setFormError("GPS indisponivel neste dispositivo.");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        setLatitude(String(lat));
        setLongitude(String(lon));
        setLocationAccuracy(Number.isFinite(accuracy) ? accuracy : null);

        try {
          const response = await fetch(
            `/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&accuracy=${encodeURIComponent(accuracy)}`
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error ?? "Nao foi possivel buscar o endereco.");
          setEndereco(data?.address || `Lat: ${lat.toFixed(6)}, Lng: ${lon.toFixed(6)}`);
        } catch {
          setEndereco(`Lat: ${lat.toFixed(6)}, Lng: ${lon.toFixed(6)}`);
        } finally {
          setLocationLoading(false);
        }
      },
      () => {
        setLocationLoading(false);
        setFormError("Nao foi possivel obter sua localizacao.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    setMediaCount(event.target.files?.length ?? 0);
  }

  function handlePreSubmit(event: { preventDefault(): void }) {
    if (!precisaGuincho) {
      event.preventDefault();
      setFormError("Informe se precisa de guincho.");
      return;
    }
    setFormError(null);
  }

  return (
    <form action={formAction} onSubmit={handlePreSubmit} className="mx-auto max-w-3xl space-y-5">
      <input type="hidden" name="tipo_sinistro" value="socorro" />
      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <h1 className="text-2xl font-bold tracking-tight">Solicitar socorro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha os dados para acionar manutencao e monitoramento.
        </p>
        <div className="mt-3 rounded-lg border border-blue-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Funcionario</p>
          <p className="font-semibold">{user.name}</p>
          <p className="text-sm text-muted-foreground">E-mail: {user.email}</p>
        </div>
      </div>

      {(!actionState.ok && actionState.error) || formError ? (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {formError ?? (!actionState.ok ? actionState.error : null)}
        </div>
      ) : null}

      <section className="space-y-4 rounded-md border bg-white p-4 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="endereco">Endereco *</Label>
          <Input
            id="endereco"
            name="endereco"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            required
            placeholder="Digite o endereco"
          />
          <Button type="button" variant="outline" onClick={getLocation} disabled={locationLoading} className="w-full">
            {locationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4 text-red-500" />}
            Usar minha localizacao
          </Button>
          {latitude && longitude ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                Precisao GPS: {locationAccuracy != null ? `${Math.round(locationAccuracy)} m` : "nao informada"}
              </span>
              <a
                href={`https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-700 hover:underline"
              >
                Conferir no Google Maps
              </a>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="numero_frota">Numero da frota</Label>
          <Input id="numero_frota" name="numero_frota" placeholder="Ex: 4021" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="setor">Setor *</Label>
          <select
            id="setor"
            name="setor"
            required
            defaultValue=""
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>Selecione um setor</option>
            {SETORES.map((setor) => (
              <option key={setor} value={setor}>{setor}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefone_solicitante">Telefone do motorista *</Label>
          <Input
            id="telefone_solicitante"
            name="telefone_solicitante"
            required
            inputMode="numeric"
            placeholder="Somente numeros"
            onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, ""); }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="descricao">Descricao *</Label>
          <textarea
            id="descricao"
            name="descricao"
            rows={4}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Descreva o problema"
          />
        </div>

        <div className="space-y-2">
          <Label>Precisa de guincho? *</Label>
          <div className="grid grid-cols-2 gap-2">
            <Choice name="precisa_guincho" value="sim" checked={precisaGuincho === "sim"} onChange={setPrecisaGuincho}>
              Sim
            </Choice>
            <Choice name="precisa_guincho" value="nao" checked={precisaGuincho === "nao"} onChange={setPrecisaGuincho}>
              Nao
            </Choice>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-md border bg-white p-4 shadow-sm">
        <Label>Imagens (opcional)</Label>
        <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-slate-50 p-4 text-center text-sm text-muted-foreground hover:bg-slate-100">
          <Camera className="mb-2 h-6 w-6 text-blue-700" aria-hidden="true" />
          Adicionar imagens
          <input
            name="media"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            className="sr-only"
            onChange={handleMediaChange}
          />
        </label>
        {mediaCount > 0 ? <p className="text-xs font-medium text-blue-700">{mediaCount} arquivo(s) selecionado(s)</p> : null}
      </section>

      <SubmitButton />
    </form>
  );
}

function Choice({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked?: boolean;
  onChange?: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex h-10 cursor-pointer items-center justify-center rounded-md border bg-white px-3 text-sm font-medium transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-800"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange?.(value)}
        className="sr-only"
        required
      />
      {children}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} size="lg" className="w-full">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {pending ? "Enviando..." : "Enviar solicitacao"}
      {!pending ? <ChevronRight className="h-4 w-4" /> : null}
    </Button>
  );
}
