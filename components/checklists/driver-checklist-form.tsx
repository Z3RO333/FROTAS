"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, Search, Send } from "lucide-react";
import { enviarChecklistMotoristaAction } from "@/app/(app)/motorista/checklist/_actions";
import { CHECKLIST_GROUPS, CHECKLIST_ITEMS, type ChecklistGrupo } from "@/lib/checklists/catalog";
import type { Frota } from "@/lib/repos/frotas";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEP_LABELS = ["Frota", "KM", "Abastecimento", ...CHECKLIST_GROUPS, "Revisar"] as const;
const ABASTECIMENTO_STEP = 2;
const GRUPOS_BASE_STEP = ABASTECIMENTO_STEP + 1;
const REVISAR_STEP = STEP_LABELS.length - 1;

const TIPOS_COMBUSTIVEL = ["DIESEL_S10", "DIESEL_S500", "GASOLINA", "ETANOL", "GNV", "ARLA"] as const;

const STATUS_OPTIONS = [
  { value: "APTO", label: "Apto" },
  { value: "NAO_APTO", label: "Não apto" },
  { value: "NAO_SE_APLICA", label: "Não se aplica" },
] as const;

type OcrState = {
  km_lido: number | null;
  confianca: number;
  leitura_segura: boolean;
  precisa_digitacao_manual: boolean;
  motivo: string | null;
  texto_visivel: string | null;
  observacoes_imagem: string | null;
  error?: string;
};

export function DriverChecklistForm({ frotas }: { frotas: Frota[] }) {
  const [step, setStep] = useState(0);
  const [frotaId, setFrotaId] = useState(() => String(frotas[0]?.id ?? ""));
  const [searchOpen, setSearchOpen] = useState(false);
  const [frotaQuery, setFrotaQuery] = useState("");
  const [kmValue, setKmValue] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrState, setOcrState] = useState<OcrState | null>(null);
  const selected = useMemo(() => frotas.find((frota) => String(frota.id) === frotaId) ?? null, [frotaId, frotas]);
  const filteredFrotas = useMemo(() => {
    const query = frotaQuery.trim().toLowerCase();
    if (!query) return frotas.slice(0, 25);

    return frotas
      .filter((frota) =>
        [
          frota.frota_geral,
          frota.placa,
          frota.modelo,
          frota.chassi,
          frota.localizacao,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 25);
  }, [frotaQuery, frotas]);
  const progress = Math.round(((step + 1) / STEP_LABELS.length) * 100);

  async function handleFotoKmChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setOcrState(null);
    if (!file) return;

    setOcrLoading(true);
    const body = new FormData();
    body.append("foto_km", file);

    try {
      const response = await fetch("/api/checklists/ocr-km", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Falha ao analisar imagem.");

      setOcrState(data);
      if (data.leitura_segura && data.km_lido != null) {
        setKmValue(String(data.km_lido));
      }
    } catch (error) {
      setOcrState({
        km_lido: null,
        confianca: 0,
        leitura_segura: false,
        precisa_digitacao_manual: true,
        motivo: error instanceof Error ? error.message : "Não conseguimos ler a imagem.",
        texto_visivel: null,
        observacoes_imagem: null,
        error: error instanceof Error ? error.message : "Não conseguimos ler a imagem.",
      });
    } finally {
      setOcrLoading(false);
    }
  }

  return (
    <>
    <form action={enviarChecklistMotoristaAction} className="mx-auto max-w-5xl space-y-5">
      <div className="rounded-md border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Checklist {step + 1} de {STEP_LABELS.length}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{STEP_LABELS[step]}</h1>
          </div>
          <Badge variant="outline">{progress}%</Badge>
        </div>
        <div className="mt-4 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-blue-700 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <section hidden={step !== 0} className="space-y-4 rounded-md border bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <Label htmlFor="frota_id">Selecionar frota</Label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <select
                id="frota_id"
                name="frota_id"
                value={frotaId}
                onChange={(event) => setFrotaId(event.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {frotas.map((frota) => (
                  <option key={frota.id} value={frota.id}>
                    {frota.frota_geral ?? `Frota #${frota.id}`} - {frota.modelo ?? "Sem modelo"}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" className="h-11" onClick={() => setSearchOpen(true)}>
                <Search className="h-4 w-4" aria-hidden="true" />
                Pesquisar
              </Button>
            </div>
            {selected ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadonlyField label="Placa" value={selected.placa} />
                <ReadonlyField label="Modelo" value={selected.modelo} />
                <ReadonlyField label="Chassi" value={selected.chassi} />
                <ReadonlyField label="Setor" value={selected.localizacao} />
              </div>
            ) : null}
          </div>
          <div className="rounded-md border bg-slate-50 p-4">
            <p className="text-sm font-medium text-muted-foreground">Status da frota</p>
            <div className="mt-2 text-2xl font-semibold">{selected?.status ?? "disponivel"}</div>
            <p className="mt-2 text-sm text-muted-foreground">Ultimo KM: {formatNumber(selected?.km_atual)}</p>
          </div>
        </div>
      </section>

      <section hidden={step !== 1} className="space-y-4 rounded-md border bg-white p-4 shadow-sm">
        {selected && selected.km_atual == null ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Primeiro KM desta frota.</strong> Foto do hodômetro é obrigatória. O valor informado será
            registrado como KM inicial e validado pelo administrador.
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="foto_km">Foto do painel</Label>
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-slate-50 p-4 text-center text-sm text-muted-foreground hover:bg-slate-100">
              <Camera className="mb-2 h-6 w-6 text-blue-700" aria-hidden="true" />
              Tirar foto ou anexar imagem
              <input
                id="foto_km"
                name="foto_km"
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={handleFotoKmChange}
              />
            </label>
            {ocrLoading ? (
              <div className="flex items-center gap-2 rounded-md border bg-blue-50 p-3 text-sm text-blue-900">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Lendo quilometragem pela IA...
              </div>
            ) : ocrState ? (
              <div
                className={
                  ocrState.leitura_segura
                    ? "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
                    : "rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                }
              >
                {ocrState.leitura_segura && ocrState.km_lido != null ? (
                  <strong>KM identificado pela IA: {formatNumber(ocrState.km_lido)}</strong>
                ) : (
                  <strong>Não conseguimos ler a quilometragem com segurança.</strong>
                )}
                <div className="mt-1">
                  Confiança: {Math.round((ocrState.confianca ?? 0) * 100)}%
                  {ocrState.motivo ? ` · ${ocrState.motivo}` : ""}
                </div>
              </div>
            ) : null}
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="km_informado">Quilometragem atual</Label>
              <Input
                id="km_informado"
                name="km_informado"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="58240"
                value={kmValue}
                onChange={(event) => setKmValue(event.target.value)}
              />
            </div>
            <div className="rounded-md border bg-amber-50 p-3 text-sm text-amber-900">
              Ultimo KM registrado: {formatNumber(selected?.km_atual)}
            </div>
            <div className="space-y-2">
              <Label htmlFor="justificativa_km">Justificativa de divergencia</Label>
              <textarea
                id="justificativa_km"
                name="justificativa_km"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </section>

      <section hidden={step !== ABASTECIMENTO_STEP} className="space-y-4 rounded-md border bg-white p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Preencha apenas se houve abastecimento neste turno. Deixe em branco caso não tenha abastecido.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="tipo_combustivel">Tipo de combustivel</Label>
            <select
              id="tipo_combustivel"
              name="tipo_combustivel"
              defaultValue=""
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Nenhum</option>
              {TIPOS_COMBUSTIVEL.map((tipo) => (
                <option key={tipo} value={tipo}>{tipo.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="litros_combustivel">Litros combustivel</Label>
            <Input
              id="litros_combustivel"
              name="litros_combustivel"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="90"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="litros_arla">Litros Arla</Label>
            <Input
              id="litros_arla"
              name="litros_arla"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="foto_comprovante">Foto do comprovante (opcional)</Label>
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-slate-50 p-4 text-center text-sm text-muted-foreground hover:bg-slate-100">
            <Camera className="mb-2 h-5 w-5 text-blue-700" aria-hidden="true" />
            Anexar foto do comprovante
            <input id="foto_comprovante" name="foto_comprovante" type="file" accept="image/*" capture="environment" className="sr-only" />
          </label>
        </div>
      </section>

      {CHECKLIST_GROUPS.map((group, index) => (
        <ChecklistGroupSection key={group} group={group} step={step} expectedStep={index + GRUPOS_BASE_STEP} />
      ))}

      <section hidden={step !== REVISAR_STEP} className="space-y-4 rounded-md border bg-white p-4 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="observacao_original">Observacoes gerais</Label>
          <textarea
            id="observacao_original"
            name="observacao_original"
            rows={5}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Ex.: farol dianteiro esquerdo queimado e pneu meio baixo"
          />
        </div>
        <div className="rounded-md border bg-slate-50 p-4 text-sm text-muted-foreground">
          Ao enviar, o sistema valida KM, evidências de itens não aptos e cria pendências automaticamente quando houver
          item crítico.
        </div>
      </section>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border bg-white/95 p-3 shadow-sm backdrop-blur">
        <Button type="button" variant="outline" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </Button>
        {step < STEP_LABELS.length - 1 ? (
          <Button type="button" onClick={() => setStep((value) => Math.min(STEP_LABELS.length - 1, value + 1))}>
            Avançar
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="submit">
            <Send className="h-4 w-4" aria-hidden="true" />
            Enviar checklist
          </Button>
        )}
      </div>
    </form>
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pesquisar frota</DialogTitle>
          <DialogDescription>Busque por código, placa, modelo, chassi ou setor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={frotaQuery}
              onChange={(event) => setFrotaQuery(event.target.value)}
              placeholder="Ex.: HR29, PHS2E26, Hyundai"
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {filteredFrotas.length > 0 ? (
              filteredFrotas.map((frota) => (
                <button
                  key={frota.id}
                  type="button"
                  onClick={() => {
                    setFrotaId(String(frota.id));
                    setSearchOpen(false);
                    setFrotaQuery("");
                  }}
                  className="w-full rounded-md border bg-white p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-semibold">{frota.frota_geral ?? `Frota #${frota.id}`}</div>
                      <div className="text-sm text-muted-foreground">
                        {frota.placa ?? "Sem placa"} - {frota.modelo ?? "Sem modelo"}
                      </div>
                    </div>
                    <Badge variant="outline">{frota.status ?? "disponivel"}</Badge>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <span>Chassi: {frota.chassi ?? "-"}</span>
              <span>Setor: {frota.localizacao ?? "-"}</span>
                    <span>KM: {formatNumber(frota.km_atual)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-md border bg-slate-50 p-4 text-center text-sm text-muted-foreground">
                Nenhuma frota encontrada.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function ChecklistGroupSection({
  group,
  step,
  expectedStep,
}: {
  group: ChecklistGrupo;
  step: number;
  expectedStep: number;
}) {
  const items = CHECKLIST_ITEMS.filter((item) => item.grupo === group);

  return (
    <section hidden={step !== expectedStep} className="space-y-3 rounded-md border bg-white p-4 shadow-sm">
      {items.map((item) => (
        <div key={item.codigo} className="rounded-md border bg-slate-50 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <span className="font-medium">{item.nome}</span>
              {item.critico ? <Badge className="bg-red-600 text-white hover:bg-red-600">Crítico</Badge> : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {STATUS_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name={`item_status_${item.codigo}`}
                    value={option.value}
                    defaultChecked={option.value === "APTO"}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
            <Input name={`item_observacao_${item.codigo}`} placeholder="Observação" />
            <Input name={`item_foto_${item.codigo}`} type="file" accept="image/*" />
          </div>
        </div>
      ))}
    </section>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-md border bg-slate-50 px-3 py-2">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 min-h-5 break-words text-sm font-medium">{value ?? "-"}</div>
    </div>
  );
}
