"use client";

import { type ChangeEvent, useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Camera, ChevronRight, Loader2, MapPin, Send } from "lucide-react";
import { enviarSinistroMotoristaAction } from "@/app/(app)/motorista/sinistro/_actions";
import { SINISTRO_MOTORISTA_INITIAL_STATE } from "@/app/(app)/motorista/sinistro/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGeolocationAddress } from "@/hooks/use-geolocation-address";
import { useSessionDraft } from "@/hooks/use-session-draft";
import {
  buildSinistroDraft,
  isSinistroDraftExpired,
  sinistroDraftKey,
  sinistroDraftSchema,
} from "@/lib/sinistros/draft-schema";
import type { Frota } from "@/lib/repos/frotas";
import { cn } from "@/lib/utils";

function asChoice(value: string): "sim" | "nao" | undefined {
  return value === "sim" || value === "nao" ? value : undefined;
}

export function SocorroForm({
  user,
  frotas,
  setoresDisponiveis,
}: {
  user: { name: string; email: string };
  frotas: Frota[];
  setoresDisponiveis: string[];
}) {
  const router = useRouter();
  const submissionIdRef = useRef<string | null>(null);
  const actionWithSubmissionId = useCallback(
    async (prevState: Parameters<typeof enviarSinistroMotoristaAction>[0], formData: FormData) => {
      if (!submissionIdRef.current) submissionIdRef.current = crypto.randomUUID();
      formData.set("submission_id", submissionIdRef.current);
      return enviarSinistroMotoristaAction(prevState, formData);
    },
    []
  );
  const [actionState, formAction] = useActionState(
    actionWithSubmissionId,
    SINISTRO_MOTORISTA_INITIAL_STATE
  );
  const [frotaId, setFrotaId] = useState("");
  const [frotaQuery, setFrotaQuery] = useState("");
  const [placaQuery, setPlacaQuery] = useState("");
  const {
    loading: locationLoading,
    endereco,
    latitude,
    longitude,
    accuracy: locationAccuracy,
    errorMessage: locationError,
    locate: getLocation,
    setEndereco,
    restore: restoreLocation,
  } = useGeolocationAddress();
  const [setor, setSetor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [precisaGuincho, setPrecisaGuincho] = useState("");
  const [mediaCount, setMediaCount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [setorOverride, setSetorOverride] = useState(false);

  // O setor já vem cadastrado na frota — evita perguntar de novo o que o
  // sistema já sabe. "Trocar" abre a lista completa só se precisar corrigir.
  useEffect(() => {
    if (!frotaId) return;
    const f = frotas.find((item) => String(item.id) === frotaId);
    if (f?.setor) setSetor(f.setor);
  }, [frotaId, frotas]);

  const draftKey = sinistroDraftKey(user.email, "socorro");
  const { restoredDraft, checked: draftChecked, save: saveDraft, clear: clearDraft } = useSessionDraft(
    draftKey,
    sinistroDraftSchema
  );

  useEffect(() => {
    if (!draftChecked || !restoredDraft) return;
    if (isSinistroDraftExpired(restoredDraft)) {
      clearDraft();
      return;
    }
    submissionIdRef.current = restoredDraft.submissionId;
    setFrotaId(restoredDraft.frotaId != null ? String(restoredDraft.frotaId) : "");
    // setor não é restaurado direto — o effect que deriva da frota selecionada
    // reaplica o valor certo (cadastro da frota é a fonte de verdade).
    setDescricao(restoredDraft.descricao);
    setPrecisaGuincho(restoredDraft.precisaGuincho ?? "");
    restoreLocation({
      endereco: restoredDraft.endereco,
      latitude: restoredDraft.latitude,
      longitude: restoredDraft.longitude,
    });
    setDraftRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftChecked, restoredDraft]);

  // Telefone do solicitante fica fora do draft (dado pessoal) — só o resto do
  // progresso é salvo.
  useEffect(() => {
    if (!draftChecked) return;
    const handle = window.setTimeout(() => {
      if (!submissionIdRef.current) submissionIdRef.current = crypto.randomUUID();
      saveDraft(
        buildSinistroDraft({
          submissionId: submissionIdRef.current,
          tipo: "socorro",
          frotaId: frotaId ? Number(frotaId) : null,
          endereco,
          latitude,
          longitude,
          setor,
          descricao,
          precisaGuincho: asChoice(precisaGuincho),
        })
      );
    }, 400);
    return () => window.clearTimeout(handle);
  }, [draftChecked, frotaId, endereco, latitude, longitude, setor, descricao, precisaGuincho, saveDraft]);

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

  const selectedFrota = frotas.find((frota) => String(frota.id) === frotaId) ?? null;

  useEffect(() => {
    if (actionState.ok) {
      clearDraft();
      router.push(actionState.redirectTo);
    }
  }, [actionState, router, clearDraft]);

  function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    setMediaCount(event.target.files?.length ?? 0);
  }

  function handlePreSubmit(event: { preventDefault(): void }) {
    if (!setor) {
      event.preventDefault();
      setFormError("Selecione a frota (ou informe o setor manualmente).");
      return;
    }
    if (!precisaGuincho) {
      event.preventDefault();
      setFormError("Informe se precisa de guincho.");
      return;
    }
    setFormError(null);
  }

  return (
    <form action={formAction} onSubmit={handlePreSubmit} className="mx-auto max-w-3xl space-y-5">
      <input type="hidden" name="submission_id" value="" />
      <input type="hidden" name="tipo_sinistro" value="socorro" />
      <input type="hidden" name="frota_id" value={frotaId} />
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

      {draftRestored ? (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Rascunho recuperado — retomamos de onde você parou. <strong>As imagens precisam ser anexadas novamente.</strong>
          </span>
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
          {locationError ? (
            <p className="text-xs font-medium text-red-700">{locationError}</p>
          ) : null}
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

        <div className="space-y-3">
          <div>
            <Label>Frota envolvida</Label>
            {selectedFrota ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Selecionada: <strong>{selectedFrota.frota_geral ?? selectedFrota.id}</strong>
                {" - "}Placa: <strong>{selectedFrota.placa ?? "-"}</strong>
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Buscar por frota" value={frotaQuery} onChange={(e) => setFrotaQuery(e.target.value)} />
            <Input placeholder="Buscar por placa" value={placaQuery} onChange={(e) => setPlacaQuery(e.target.value)} />
          </div>
          <div className="max-h-48 overflow-y-auto rounded-md border">
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="setor">Setor *</Label>
          {setorOverride || !selectedFrota ? (
            <select
              id="setor"
              name="setor"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:h-10 sm:text-sm"
            >
              <option value="" disabled>
                {selectedFrota ? "Selecione um setor" : "Selecione a frota primeiro"}
              </option>
              {setoresDisponiveis.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex h-11 items-center justify-between rounded-md border bg-slate-50 px-3 text-sm sm:h-10">
              <input type="hidden" name="setor" value={setor} />
              <span className={setor ? "text-foreground" : "text-muted-foreground"}>
                {setor || "Nao informado"}
              </span>
              <button
                type="button"
                className="text-xs font-medium text-blue-700 hover:underline"
                onClick={() => setSetorOverride(true)}
              >
                Trocar
              </button>
            </div>
          )}
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
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
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
        "flex h-11 cursor-pointer items-center justify-center rounded-md border bg-white px-3 text-sm font-medium transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-800 sm:h-10"
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
