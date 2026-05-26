"use client";

import { type ChangeEvent, useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Camera, ChevronRight, Loader2, MapPin, Plus, Send, Trash2 } from "lucide-react";
import { enviarSinistroMotoristaAction } from "@/app/(app)/motorista/sinistro/_actions";
import { SINISTRO_MOTORISTA_INITIAL_STATE } from "@/app/(app)/motorista/sinistro/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Frota } from "@/lib/repos/frotas";
import { cn } from "@/lib/utils";

export type SinistroTipo = "veiculo" | "casa";
type TerceiroDraft = { nome: string; telefone: string; cpf: string };

const SETORES = [
  "Expedicao E-Commerce",
  "Expedicao Lojas",
  "Expedicao Baus",
  "MarketPlace",
  "Ship From Store",
  "Manutencao",
  "Administrativo",
];

const TIPO_COPY: Record<SinistroTipo, { title: string; description: string; frotaTitle: string }> = {
  veiculo: {
    title: "Acidente com Veiculo",
    description: "Registre o sinistro envolvendo carro, moto ou caminhao.",
    frotaTitle: "Frota envolvida",
  },
  casa: {
    title: "Acidente com Casas",
    description: "Registre o sinistro em residencia e anexe evidencias.",
    frotaTitle: "Frota envolvida no atendimento",
  },
};

export function DriverSinistroForm({ frotas, tipo }: { frotas: Frota[]; tipo: SinistroTipo }) {
  const router = useRouter();
  const [actionState, formAction] = useActionState(
    enviarSinistroMotoristaAction,
    SINISTRO_MOTORISTA_INITIAL_STATE
  );
  const [frotaId, setFrotaId] = useState("");
  const [frotaQuery, setFrotaQuery] = useState("");
  const [placaQuery, setPlacaQuery] = useState("");
  const [houveFeridos, setHouveFeridos] = useState("");
  const [terceiros, setTerceiros] = useState<TerceiroDraft[]>([]);
  const [mediaCount, setMediaCount] = useState(0);
  const [locationLoading, setLocationLoading] = useState(false);
  const [endereco, setEndereco] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (actionState.ok) router.push(actionState.redirectTo);
  }, [actionState, router]);

  const filteredFrotas = useMemo(() => {
    const q = frotaQuery.trim().toLowerCase();
    const p = placaQuery.trim().toLowerCase();
    return frotas
      .filter((frota) => {
        if (q && !String(frota.frota_geral ?? "").toLowerCase().includes(q)) return false;
        if (p && !String(frota.placa ?? "").toLowerCase().includes(p)) return false;
        return true;
      })
      .slice(0, 50);
  }, [frotaQuery, placaQuery, frotas]);

  const selected = frotas.find((frota) => String(frota.id) === frotaId) ?? null;

  function addTerceiro() {
    setTerceiros((prev) => [...prev, { nome: "", telefone: "", cpf: "" }].slice(0, 10));
  }

  function removeTerceiro(index: number) {
    setTerceiros((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTerceiro(index: number, field: keyof TerceiroDraft, value: string) {
    const cleanValue = field === "nome" ? value : value.replace(/\D/g, "");
    setTerceiros((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: cleanValue } : item)));
  }

  function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    setMediaCount(event.target.files?.length ?? 0);
  }

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

  function handlePreSubmit(event: { preventDefault(): void }) {
    if (!frotaId) {
      event.preventDefault();
      setFormError("Selecione a frota envolvida.");
      return;
    }
    if (!houveFeridos) {
      event.preventDefault();
      setFormError("Informe se houve feridos.");
      return;
    }
    setFormError(null);
  }

  return (
    <form action={formAction} onSubmit={handlePreSubmit} className="mx-auto max-w-3xl space-y-5">
      <input type="hidden" name="tipo_sinistro" value={tipo} />
      <input type="hidden" name="frota_id" value={frotaId} />
      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />
      <input type="hidden" name="terceiros_quantidade" value={terceiros.length} />

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-700">Motorista</p>
        <h1 className="text-2xl font-bold tracking-tight">{TIPO_COPY[tipo].title}</h1>
        <p className="text-sm text-muted-foreground">{TIPO_COPY[tipo].description}</p>
      </div>

      {(!actionState.ok && actionState.error) || formError ? (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {formError ?? (!actionState.ok ? actionState.error : null)}
        </div>
      ) : null}

      <section className="space-y-4 rounded-md border bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">{TIPO_COPY[tipo].frotaTitle}</h2>
          {selected ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Selecionada: <strong>{selected.frota_geral ?? selected.id}</strong>
              {" - "}Placa: <strong>{selected.placa ?? "-"}</strong>
            </p>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Buscar por frota" value={frotaQuery} onChange={(e) => setFrotaQuery(e.target.value)} />
          <Input placeholder="Buscar por placa" value={placaQuery} onChange={(e) => setPlacaQuery(e.target.value)} />
        </div>

        <div className="max-h-64 overflow-y-auto rounded-md border">
          {filteredFrotas.map((frota) => {
            const isSelected = String(frota.id) === frotaId;
            const indisponivel = frota.vendido || !frota.ativo;
            return (
              <button
                key={frota.id}
                type="button"
                disabled={Boolean(indisponivel)}
                onClick={() => setFrotaId(String(frota.id))}
                className={cn(
                  "grid w-full grid-cols-[1fr_auto] gap-3 border-b p-3 text-left text-sm transition-colors last:border-0",
                  isSelected ? "bg-blue-50 text-blue-800" : "bg-white hover:bg-slate-50",
                  indisponivel && "cursor-not-allowed bg-slate-50 text-slate-400"
                )}
              >
                <span>
                  <span className="block font-semibold">{frota.frota_geral ?? frota.id}</span>
                  <span className="text-muted-foreground">{frota.modelo ?? "Modelo nao informado"}</span>
                </span>
                <span className="font-medium">{frota.placa ?? "-"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-md border bg-white p-4 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="descricao">Descreva o sinistro *</Label>
          <textarea
            id="descricao"
            name="descricao"
            rows={5}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Conte o que aconteceu, onde houve impacto e quais danos sao visiveis."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endereco">Endereco do sinistro *</Label>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              id="endereco"
              name="endereco"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              required
              placeholder="Rua, numero, bairro, cidade"
            />
            <Button type="button" variant="outline" onClick={getLocation} disabled={locationLoading}>
              {locationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              GPS
            </Button>
          </div>
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
              <span>Revise o endereco antes de enviar.</span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="setor">Setor</Label>
            <select
              id="setor"
              name="setor"
              defaultValue=""
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione</option>
              {SETORES.map((setor) => (
                <option key={setor} value={setor}>
                  {setor}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Houve feridos? *</Label>
            <div className="grid grid-cols-2 gap-2">
              <Choice name="houve_feridos" value="sim" checked={houveFeridos === "sim"} onChange={setHouveFeridos}>
                Sim
              </Choice>
              <Choice name="houve_feridos" value="nao" checked={houveFeridos === "nao"} onChange={setHouveFeridos}>
                Nao
              </Choice>
            </div>
          </div>
        </div>

        {houveFeridos === "sim" ? (
          <div className="space-y-2">
            <Label>SAMU ou bombeiros esteve presente? *</Label>
            <div className="grid grid-cols-2 gap-2">
              <Choice name="samu_bombeiros_presente" value="sim">Sim</Choice>
              <Choice name="samu_bombeiros_presente" value="nao">Nao</Choice>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-md border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Terceiros afetados</h2>
            <p className="text-sm text-muted-foreground">Adicione nome, telefone e CPF quando houver terceiro.</p>
          </div>
          <Button type="button" variant="outline" onClick={addTerceiro}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>

        {terceiros.length === 0 ? (
          <div className="rounded-md border bg-slate-50 p-3 text-sm text-muted-foreground">Nenhum terceiro informado.</div>
        ) : (
          <div className="space-y-3">
            {terceiros.map((terceiro, index) => (
              <div key={index} className="space-y-3 rounded-md border bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Terceiro {index + 1}</p>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeTerceiro(index)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    name={`terceiro_${index}_nome`}
                    value={terceiro.nome}
                    onChange={(e) => updateTerceiro(index, "nome", e.target.value)}
                    placeholder="Nome completo"
                    required
                  />
                  <Input
                    name={`terceiro_${index}_telefone`}
                    value={terceiro.telefone}
                    onChange={(e) => updateTerceiro(index, "telefone", e.target.value)}
                    placeholder="Telefone"
                    inputMode="numeric"
                    required
                  />
                  <Input
                    name={`terceiro_${index}_cpf`}
                    value={terceiro.cpf}
                    onChange={(e) => updateTerceiro(index, "cpf", e.target.value)}
                    placeholder="CPF"
                    inputMode="numeric"
                    required
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-md border bg-white p-4 shadow-sm">
        <Label htmlFor="media">Fotos do sinistro</Label>
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-slate-50 p-4 text-center text-sm text-muted-foreground hover:bg-slate-100">
          <Camera className="mb-2 h-6 w-6 text-blue-700" aria-hidden="true" />
          Tirar foto ou anexar imagens
          <input
            id="media"
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

      <div className="flex justify-end">
        <SubmitButton />
      </div>
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
    <Button type="submit" disabled={pending} size="lg">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {pending ? "Enviando..." : "Enviar sinistro"}
      {!pending ? <ChevronRight className="h-4 w-4" /> : null}
    </Button>
  );
}
