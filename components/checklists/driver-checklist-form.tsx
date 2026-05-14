"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import { Camera, ChevronRight, Info, Loader2, Search, Send } from "lucide-react";
import { enviarChecklistMotoristaAction } from "@/app/(app)/motorista/checklist/_actions";
import { CHECKLIST_ITEMS } from "@/lib/checklists/catalog";
import type { Frota } from "@/lib/repos/frotas";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ChecklistItemStatus = "APTO" | "NAO_APTO" | "NAO_SE_APLICA";

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

const STEPS = ["Selecionar veículo", "Realizar Checklist", "Registrar Hodômetro"] as const;
const TIPOS_COMBUSTIVEL = ["DIESEL_S10", "DIESEL_S500", "GASOLINA", "ETANOL", "GNV", "ARLA"] as const;

export function DriverChecklistForm({ frotas }: { frotas: Frota[] }) {
  const [step, setStep] = useState(0);
  const [frotaId, setFrotaId] = useState("");
  const [frotaQuery, setFrotaQuery] = useState("");
  const [kmValue, setKmValue] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrState, setOcrState] = useState<OcrState | null>(null);
  const [itemStatuses, setItemStatuses] = useState<Record<string, ChecklistItemStatus>>(
    () => Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.codigo, "APTO" as ChecklistItemStatus]))
  );
  const [nivelCombustivel, setNivelCombustivel] = useState(0);
  const [nivelArla, setNivelArla] = useState(0);

  const selected = useMemo(
    () => frotas.find((f) => String(f.id) === frotaId) ?? null,
    [frotaId, frotas]
  );

  const filteredFrotas = useMemo(() => {
    const q = frotaQuery.trim().toLowerCase();
    if (!q) return frotas.slice(0, 50);
    return frotas
      .filter((f) =>
        [f.frota_geral, f.placa, f.modelo, f.chassi, f.localizacao]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 50);
  }, [frotaQuery, frotas]);

  async function handleFotoKmChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setOcrState(null);
    if (!file) return;
    setOcrLoading(true);
    const body = new FormData();
    body.append("foto_km", file);
    try {
      const response = await fetch("/api/checklists/ocr-km", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Falha ao analisar imagem.");
      setOcrState(data);
      if (data.leitura_segura && data.km_lido != null) setKmValue(String(data.km_lido));
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

  function toggleItem(codigo: string) {
    setItemStatuses((prev) => ({
      ...prev,
      [codigo]: prev[codigo] === "APTO" ? "NAO_APTO" : "APTO",
    }));
  }

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <form action={enviarChecklistMotoristaAction} className="mx-auto max-w-3xl space-y-5">
      {/* Hidden fields managed by state */}
      <input type="hidden" name="frota_id" value={frotaId} />
      {CHECKLIST_ITEMS.map((item) => (
        <input
          key={item.codigo}
          type="hidden"
          name={`item_status_${item.codigo}`}
          value={itemStatuses[item.codigo]}
        />
      ))}

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Registrar checklist</h1>
        <p className="text-sm text-muted-foreground">Registre o checklist de veículo.</p>
      </div>

      {/* Step wizard */}
      <div>
        <div className="flex items-center gap-1 text-sm">
          {STEPS.map((label, i) => (
            <span key={label} className="flex items-center gap-1">
              <span
                className={
                  i === step
                    ? "font-semibold text-blue-600"
                    : i < step
                      ? "text-slate-500"
                      : "text-muted-foreground"
                }
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              )}
            </span>
          ))}
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100">
          <div
            className="h-1.5 rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── Step 0: Selecionar veículo ── */}
      <section hidden={step !== 0} className="space-y-4">
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          Para começar, selecione um veículo para realizar o checklist.
        </div>

        {selected && (
          <div className="flex items-center justify-between gap-4 rounded-md border bg-white p-4 shadow-sm">
            <div>
              <div className="font-semibold">
                {selected.modelo ?? "Sem modelo"}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                Frota: <strong>{selected.frota_geral ?? selected.id}</strong>
                {" · "}Placa: <strong>{selected.placa ?? "—"}</strong>
                {selected.localizacao ? ` · Setor: ${selected.localizacao}` : ""}
              </div>
            </div>
            <Button type="button" onClick={() => setStep(1)}>
              Prosseguir
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}

        <div className="overflow-hidden rounded-md border bg-white">
          <div className="space-y-2 border-b p-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Pesquisar veículo..."
                className="pl-9"
                value={frotaQuery}
                onChange={(e) => setFrotaQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredFrotas.length} resultado{filteredFrotas.length !== 1 ? "s" : ""} mostrado
              {filteredFrotas.length !== 1 ? "s" : ""}
              {frotas.length > 50
                ? ". Use o filtro de pesquisa se você não encontrar o que está procurando."
                : "."}
            </p>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b">
                  <th className="w-10 p-3" />
                  <th className="p-3 text-left font-medium text-muted-foreground">Frota</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Placa</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Modelo</th>
                </tr>
              </thead>
              <tbody>
                {filteredFrotas.map((frota) => {
                  const isSelected = String(frota.id) === frotaId;
                  return (
                    <tr
                      key={frota.id}
                      onClick={() => setFrotaId(String(frota.id))}
                      className={`cursor-pointer border-b transition-colors last:border-0 hover:bg-slate-50 ${
                        isSelected ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          readOnly
                          checked={isSelected}
                          className="h-4 w-4 accent-blue-600"
                          aria-label={`Selecionar frota ${frota.frota_geral}`}
                        />
                      </td>
                      <td className={`p-3 font-medium ${isSelected ? "text-blue-600" : ""}`}>
                        {frota.frota_geral ?? frota.id}
                      </td>
                      <td className={`p-3 ${isSelected ? "text-blue-600" : ""}`}>
                        {frota.placa ?? "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">{frota.modelo ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Step 1: Realizar Checklist ── */}
      <section hidden={step !== 1} className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Marque as opções para concluir o checklist. Você também pode adicionar um comentário e até fotos no
          final do formulário.
        </div>

        <div className="space-y-6 rounded-md border bg-white p-5 shadow-sm">
          {/* Fuel level selectors */}
          <div className="grid grid-cols-2 gap-6">
            <FuelLevelSelector
              label="Nível combustível"
              value={nivelCombustivel}
              onChange={setNivelCombustivel}
            />
            <FuelLevelSelector
              label="Nível arla"
              value={nivelArla}
              onChange={setNivelArla}
            />
          </div>

          {/* Checklist items in 2-col grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {CHECKLIST_ITEMS.map((item) => {
              const isApto = itemStatuses[item.codigo] !== "NAO_APTO";
              return (
                <div key={item.codigo} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium leading-tight">
                      {item.nome}
                      {item.critico && (
                        <span className="ml-1 text-xs text-red-500" title="Item crítico">
                          ★
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isApto}
                      onClick={() => toggleItem(item.codigo)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                        isApto ? "bg-blue-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          isApto ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {!isApto && (
                    <>
                      <p className="text-xs font-medium text-red-500">Não apto</p>
                      <Input
                        name={`item_observacao_${item.codigo}`}
                        placeholder="Descreva o problema..."
                        className="h-8 text-xs"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Observações gerais */}
          <div className="space-y-2">
            <Label htmlFor="observacao_original">Observações</Label>
            <textarea
              id="observacao_original"
              name="observacao_original"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Ex.: farol dianteiro esquerdo queimado e pneu meio baixo"
            />
          </div>

          {/* Adicionar foto (general) */}
          <div>
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-slate-50">
              <Camera className="h-4 w-4" aria-hidden="true" />
              Adicionar foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => setStep(0)}>
            ← Voltar
          </Button>
          <Button type="button" onClick={() => setStep(2)}>
            Prosseguir
            <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </section>

      {/* ── Step 2: Registrar Hodômetro ── */}
      <section hidden={step !== 2} className="space-y-4">
        <div className="space-y-5 rounded-md border bg-white p-5 shadow-sm">
          {selected && selected.km_atual == null && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Primeiro KM desta frota.</strong> Foto do hodômetro é obrigatória. O valor será
              registrado como KM inicial e validado pelo administrador.
            </div>
          )}

          {/* KM photo */}
          <div className="space-y-2">
            <Label htmlFor="foto_km">Foto do painel / hodômetro</Label>
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-slate-50 p-4 text-center text-sm text-muted-foreground hover:bg-slate-100">
              <Camera className="mb-2 h-6 w-6 text-blue-600" aria-hidden="true" />
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
                  <strong>KM identificado: {formatNumber(ocrState.km_lido)}</strong>
                ) : (
                  <strong>Não foi possível ler a quilometragem. Digite manualmente.</strong>
                )}
                {ocrState.motivo && (
                  <div className="mt-1 text-xs opacity-80">{ocrState.motivo}</div>
                )}
              </div>
            ) : null}
          </div>

          {/* KM input */}
          <div className="grid gap-4 sm:grid-cols-2">
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
                onChange={(e) => setKmValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Último KM registrado: {formatNumber(selected?.km_atual)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="justificativa_km">Justificativa de divergência</Label>
              <textarea
                id="justificativa_km"
                name="justificativa_km"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Abastecimento */}
          <div className="space-y-3 rounded-md border bg-slate-50 p-4">
            <p className="text-sm font-medium">Abastecimento (opcional)</p>
            <p className="text-xs text-muted-foreground">
              Preencha apenas se houve abastecimento neste turno.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="tipo_combustivel" className="text-xs">Tipo de combustível</Label>
                <select
                  id="tipo_combustivel"
                  name="tipo_combustivel"
                  defaultValue=""
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">Nenhum</option>
                  {TIPOS_COMBUSTIVEL.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="litros_combustivel" className="text-xs">Litros</Label>
                <Input
                  id="litros_combustivel"
                  name="litros_combustivel"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="90"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="litros_arla" className="text-xs">Litros Arla</Label>
                <Input
                  id="litros_arla"
                  name="litros_arla"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="10"
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="foto_comprovante" className="text-xs">
                Foto do comprovante (opcional)
              </Label>
              <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-white p-3 text-center text-xs text-muted-foreground hover:bg-slate-50">
                <Camera className="mb-1 h-4 w-4 text-blue-600" aria-hidden="true" />
                Anexar foto do comprovante
                <input
                  id="foto_comprovante"
                  name="foto_comprovante"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => setStep(1)}>
            ← Voltar
          </Button>
          <Button type="submit">
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            Enviar checklist
          </Button>
        </div>
      </section>
    </form>
  );
}

function FuelLevelSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((level) => {
          const filled = level <= value;
          const previewed = hovered > 0 && level <= hovered && !filled;
          return (
            <button
              key={level}
              type="button"
              onClick={() => onChange(value === level ? 0 : level)}
              onMouseEnter={() => setHovered(level)}
              onMouseLeave={() => setHovered(0)}
              className={`h-8 flex-1 rounded border-2 transition-colors ${
                filled
                  ? "border-blue-500 bg-blue-500"
                  : previewed
                    ? "border-blue-300 bg-blue-100"
                    : "border-slate-200 bg-white"
              }`}
              aria-label={`${level}/4 do tanque`}
            />
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {value === 0
          ? hovered > 0
            ? `${hovered}/4`
            : "Não informado"
          : `${value}/4`}
      </p>
    </div>
  );
}
