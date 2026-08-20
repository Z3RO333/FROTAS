"use client";

import { type ChangeEvent, useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, CheckCircle2, ChevronRight, Info, Loader2, Search, Send, XCircle } from "lucide-react";
import { enviarChecklistMotoristaAction } from "@/app/(app)/motorista/checklist/_actions";
import { CHECKLIST_MOTORISTA_INITIAL_STATE } from "@/app/(app)/motorista/checklist/types";
import { CHECKLIST_ITEMS } from "@/lib/checklists/catalog";
import { KM_VARIACAO_INCOMUM } from "@/lib/checklists/rules";
import { bloqueioChecklistRestanteMs } from "@/lib/frota-derived";
import type { Frota } from "@/lib/repos/frotas";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressBar } from "@/components/ui/progress-bar";

type ChecklistItemStatus = "APTO" | "NAO_APTO" | "NAO_SE_APLICA";

type StatusLeitura =
  | "LEITURA_SEGURA"
  | "LEITURA_SUSPEITA"
  | "LEITURA_DIVERGENTE"
  | "LEITURA_FALHOU";

type CandidatoDescartado = { valor: number; motivo: string };

type OcrState = {
  km_lido: number | null;
  confianca: number;
  leitura_segura: boolean;
  precisa_digitacao_manual: boolean;
  motivo: string | null;
  texto_visivel: string | null;
  candidatos_descartados?: CandidatoDescartado[];
  regiao_detectada?: string;
  status_leitura?: StatusLeitura;
  km_anterior_usado?: number | null;
  error?: string;
};

const STEPS = ["Selecionar veículo", "Realizar checklist", "Registrar hodômetro"] as const;
const TIPOS_COMBUSTIVEL = ["DIESEL_S10", "DIESEL_S500", "GASOLINA", "ETANOL", "GNV", "ARLA"] as const;
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

// Redimensiona e comprime a imagem no browser antes de enviar para OCR.
// De ~4 MB (foto de câmera) para ~40-60 KB — reduz upload de 4s para <0.5s em rede móvel.
// O preview usa a imagem original (boa qualidade); o OCR recebe a comprimida (suficiente para ler dígitos).
async function comprimirImagemParaOcr(file: File, maxPx = 1280, qualidade = 0.88): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(maxPx / bitmap.width, maxPx / bitmap.height, 1);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    return await new Promise<File>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(new File([blob ?? file], "odometro.jpg", { type: "image/jpeg" })),
        "image/jpeg",
        qualidade
      );
    });
  } catch {
    return file; // fallback: usa o arquivo original se Canvas não suportado
  }
}

export function DriverChecklistForm({
  frotas,
  agoraInicial,
}: {
  frotas: Frota[];
  agoraInicial: number;
}) {
  const router = useRouter();
  const fotoKmFileRef = useRef<File | null>(null);
  const submissionIdRef = useRef<string | null>(null);

  const actionWithPhotoInjection = useCallback(
    async (prevState: Parameters<typeof enviarChecklistMotoristaAction>[0], formData: FormData) => {
      if (!submissionIdRef.current) submissionIdRef.current = crypto.randomUUID();
      formData.set("submission_id", submissionIdRef.current);
      const file = fotoKmFileRef.current;
      if (file) {
        const existing = formData.get("foto_km");
        if (!(existing instanceof File) || existing.size === 0) {
          formData.set("foto_km", file);
        }
      }
      return enviarChecklistMotoristaAction(prevState, formData);
    },
    []
  );

  const [actionState, formAction] = useActionState(
    actionWithPhotoInjection,
    CHECKLIST_MOTORISTA_INITIAL_STATE
  );
  const [step, setStep] = useState(0);
  const [frotaId, setFrotaId] = useState("");
  const [frotaQuery, setFrotaQuery] = useState("");
  const [placaQuery, setPlacaQuery] = useState("");
  const [kmValue, setKmValue] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrState, setOcrState] = useState<OcrState | null>(null);
  const ocrAbortRef = useRef<AbortController | null>(null);
  const [itemStatuses, setItemStatuses] = useState<Record<string, ChecklistItemStatus>>(
    () => Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.codigo, "NAO_SE_APLICA" as ChecklistItemStatus]))
  );
  const [nivelCombustivel, setNivelCombustivel] = useState(0);
  const [nivelArla, setNivelArla] = useState(0);
  const [stepErro, setStepErro] = useState<string | null>(null);
  const [itemObservacoes, setItemObservacoes] = useState<Record<string, string>>(
    () => Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.codigo, ""]))
  );
  const [itemFotoNomes, setItemFotoNomes] = useState<Record<string, string>>({});
  const [fotoKmPreview, setFotoKmPreview] = useState<string | null>(null);
  const [agora, setAgora] = useState(agoraInicial);

  const selected = useMemo(
    () => frotas.find((f) => String(f.id) === frotaId) ?? null,
    [frotaId, frotas]
  );

  useEffect(() => {
    if (actionState.ok) router.push(actionState.redirectTo);
  }, [actionState, router]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setAgora(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Revoga blob URL quando trocar de foto ou desmontar o componente — evita memory leak
  useEffect(() => {
    return () => {
      if (fotoKmPreview) URL.revokeObjectURL(fotoKmPreview);
    };
  }, [fotoKmPreview]);

  const filteredFrotas = useMemo(() => {
    const q = frotaQuery.trim().toLowerCase();
    const p = placaQuery.trim().toLowerCase();
    return frotas.filter((f) => {
      if (q && !String(f.frota_geral ?? "").toLowerCase().includes(q)) return false;
      if (p && !String(f.placa ?? "").toLowerCase().includes(p)) return false;
      return true;
    });
  }, [frotaQuery, placaQuery, frotas]);

  async function handleFotoKmChange(event: ChangeEvent<HTMLInputElement>) {
    ocrAbortRef.current?.abort();
    const controller = new AbortController();
    ocrAbortRef.current = controller;
    const file = event.target.files?.[0];
    setOcrState(null);
    // Revoga blob URL anterior antes de criar uma nova
    if (fotoKmPreview) URL.revokeObjectURL(fotoKmPreview);
    setFotoKmPreview(null);
    fotoKmFileRef.current = null;
    if (!file || file.size === 0) {
      setOcrLoading(false);
      return;
    }
    fotoKmFileRef.current = file;
    // Preview imediato com a imagem original (qualidade total)
    setFotoKmPreview(URL.createObjectURL(file));
    setOcrLoading(true);

    // Comprime a imagem no browser antes de enviar — reduz de 3-5 MB para ~50 KB
    // Isso corta o tempo de upload de ~4s para <0.5s em rede móvel
    const fileParaOcr = await comprimirImagemParaOcr(file);
    if (controller.signal.aborted || fotoKmFileRef.current !== file) return;

    const body = new FormData();
    body.append("foto_km", fileParaOcr);
    if (selected?.km_atual != null) {
      body.append("km_anterior", String(selected.km_atual));
    }
    try {
      const response = await fetch("/api/checklists/ocr-km", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Falha ao analisar imagem.");
      if (controller.signal.aborted || fotoKmFileRef.current !== file) return;
      setOcrState(data);
      // Only auto-fill KM if reading is safe (green)
      if (data.status_leitura === "LEITURA_SEGURA" && data.km_lido != null) {
        setKmValue(String(data.km_lido));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const msg = error instanceof Error ? error.message : "Não conseguimos ler a imagem.";
      setOcrState({
        km_lido: null,
        confianca: 0,
        leitura_segura: false,
        precisa_digitacao_manual: true,
        motivo: msg,
        texto_visivel: null,
        status_leitura: "LEITURA_FALHOU",
        error: msg,
      });
    } finally {
      if (ocrAbortRef.current === controller) setOcrLoading(false);
    }
  }

  function setItemStatus(codigo: string, status: ChecklistItemStatus) {
    const next = itemStatuses[codigo] === status ? "NAO_SE_APLICA" : status;
    setItemStatuses((prev) => ({ ...prev, [codigo]: next }));
    // Limpa observação se saiu de NAO_APTO
    if (next !== "NAO_APTO") {
      setItemObservacoes((prev) => ({ ...prev, [codigo]: "" }));
      setItemFotoNomes((prev) => {
        const next = { ...prev };
        delete next[codigo];
        return next;
      });
    }
    setStepErro(null);
  }

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  // Block submission when OCR returns divergent reading and user hasn't entered manual KM + justification
  const ocrDivergente = ocrState?.status_leitura === "LEITURA_DIVERGENTE";
  const kmManualPreenchido = kmValue.trim() !== "" && parseInt(kmValue, 10) > 0;

  function avancarParaStep2() {
    const pendente = CHECKLIST_ITEMS.find(
      (item) => item.obrigatorio && itemStatuses[item.codigo] === "NAO_SE_APLICA"
    );
    if (pendente) {
      setStepErro(`"${pendente.nome}" é obrigatório. Marque OK ou Problema antes de prosseguir.`);
      return;
    }
    const semEvidencia = CHECKLIST_ITEMS.find((item) =>
      itemStatuses[item.codigo] === "NAO_APTO" && !itemObservacoes[item.codigo]?.trim()
    );
    if (semEvidencia) {
      setStepErro(`"${semEvidencia.nome}": descreva o problema antes de prosseguir.`);
      return;
    }
    setStepErro(null);
    setStep(2);
  }

  function handlePreSubmit(e: { preventDefault(): void }) {
    if (!fotoKmFileRef.current) {
      e.preventDefault();
      setStepErro("Anexe a foto do hodômetro antes de enviar.");
      return;
    }
    const km = parseInt(kmValue, 10);
    if (!Number.isFinite(km) || km <= 0) {
      e.preventDefault();
      setStepErro("Informe a quilometragem atual do veículo antes de enviar.");
      return;
    }
    // KM divergente sem justificativa também é bloqueado pelo servidor, mas avisar antes evita
    // o motorista perder o upload de todas as fotos.
    if (selected?.km_atual != null && km < selected.km_atual) {
      const justificativa = (
        document.getElementById("justificativa_km") as HTMLTextAreaElement | null
      )?.value?.trim();
      if (!justificativa) {
        e.preventDefault();
        setStepErro(
          `KM informado (${km}) é menor que o último registrado (${selected.km_atual}). Descreva a justificativa no campo ao lado.`
        );
        return;
      }
    }
    // Salto grande demais (ex: digitou o hodômetro com décimos como se fossem inteiros,
    // "110856.7" virando "1108567") também exige justificativa — evita corromper o KM da frota.
    if (
      selected?.km_atual != null &&
      km - selected.km_atual > KM_VARIACAO_INCOMUM
    ) {
      const justificativa = (
        document.getElementById("justificativa_km") as HTMLTextAreaElement | null
      )?.value?.trim();
      if (!justificativa) {
        e.preventDefault();
        setStepErro(
          `KM informado (${km}) está muito acima do último registrado (${selected.km_atual}). Confira o número e descreva a justificativa no campo ao lado.`
        );
        return;
      }
    }
    setStepErro(null);
  }

  return (
    <form action={formAction} onSubmit={handlePreSubmit} className="mx-auto max-w-3xl space-y-5">
      <input type="hidden" name="submission_id" value="" />
      <input type="hidden" name="frota_id" value={frotaId} />
      <input type="hidden" name="nivel_combustivel" value={nivelCombustivel} />
      <input type="hidden" name="nivel_arla" value={nivelArla} />
      {CHECKLIST_ITEMS.map((item) => (
        <input
          key={item.codigo}
          type="hidden"
          name={`item_status_${item.codigo}`}
          value={itemStatuses[item.codigo]}
        />
      ))}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Registrar checklist</h1>
        <p className="text-sm text-muted-foreground">Registre o checklist do veículo.</p>
      </div>

      {!actionState.ok && actionState.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {actionState.error}
        </div>
      ) : null}

      <div>
        <p className="text-sm font-medium text-blue-700 sm:hidden">
          Etapa {step + 1} de {STEPS.length} · {STEPS[step]}
        </p>
        <div className="hidden items-center gap-1 text-sm sm:flex">
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
        <ProgressBar
          className="mt-2"
          value={progress}
          label={`Progresso do checklist: ${Math.round(progress)}%`}
        />
      </div>

      <section hidden={step !== 0} className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Selecione o veículo que você vai utilizar.</p>
            <p className="mt-0.5 text-xs opacity-80">
              Veículos em manutenção ou com checklist feito há menos de 30 minutos ficam em cinza.
              Use os filtros por número de frota ou placa para encontrar o seu rapidamente.
            </p>
          </div>
        </div>

        {selected && (
          <div className="flex flex-col gap-4 rounded-md border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="font-semibold">{selected.modelo ?? "Sem modelo"}</div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                Frota: <strong>{selected.frota_geral ?? selected.id}</strong>
                {" - "}Placa: <strong>{selected.placa ?? "-"}</strong>
                {selected.localizacao ? ` - Local: ${selected.localizacao}` : ""}
                {selected.setor ? ` - Setor: ${selected.setor}` : ""}
              </div>
            </div>
            <Button type="button" onClick={() => setStep(1)} className="w-full shrink-0 sm:w-auto">
              Prosseguir
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}

        <div className="overflow-hidden rounded-md border bg-white">
          <div className="space-y-2 border-b p-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Nº frota..."
                  className="pl-9"
                  value={frotaQuery}
                  onChange={(e) => setFrotaQuery(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Placa..."
                  className="pl-9"
                  value={placaQuery}
                  onChange={(e) => setPlacaQuery(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredFrotas.length} resultado{filteredFrotas.length !== 1 ? "s" : ""} mostrado
              {filteredFrotas.length !== 1 ? "s" : ""}.
            </p>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b">
                  <th className="w-10 p-3" />
                  <th className="p-3 text-left font-medium text-muted-foreground">Frota</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Placa</th>
                  <th className="hidden p-3 text-left font-medium text-muted-foreground sm:table-cell">Modelo</th>
                </tr>
              </thead>
              <tbody>
                {filteredFrotas.map((frota) => {
                  const isSelected = String(frota.id) === frotaId;
                  const fAny = frota as Frota & {
                    manutencao_motivo?: string | null;
                    manutencao_bloqueia_checklist?: boolean | null;
                  };
                  const bloqueada =
                    frota.status === "manutencao" && fAny.manutencao_bloqueia_checklist !== false;
                  const bloqueadaVenda = frota.vendido || !frota.ativo;
                  const bloqueioRestante = bloqueioChecklistRestanteMs(frota.ultimo_checklist_em, agora);
                  const bloqueadaChecklist = bloqueioRestante > 0;
                  const minutosRestantes = Math.ceil(bloqueioRestante / 60_000);
                  const indisponivel = bloqueada || bloqueadaVenda || bloqueadaChecklist;

                  return (
                    <tr
                      key={frota.id}
                      onClick={() => {
                        if (indisponivel) return;
                        setFrotaId(String(frota.id));
                      }}
                      className={`border-b transition-colors last:border-0 ${
                        indisponivel
                          ? "cursor-not-allowed bg-slate-50/70 opacity-60"
                          : `cursor-pointer hover:bg-slate-50 ${isSelected ? "bg-blue-50" : ""}`
                      }`}
                      title={
                        bloqueada
                          ? `Em manutenção: ${fAny.manutencao_motivo ?? "sem motivo"}`
                          : bloqueadaVenda
                            ? "Frota indisponível"
                            : bloqueadaChecklist
                              ? `Novo checklist liberado em ${minutosRestantes} minuto(s)`
                              : undefined
                      }
                    >
                      <td className="p-2 sm:p-3">
                        <input
                          type="checkbox"
                          readOnly
                          checked={isSelected && !indisponivel}
                          disabled={indisponivel}
                          className="h-4 w-4 accent-blue-600"
                          aria-label={`Selecionar frota ${frota.frota_geral}`}
                        />
                      </td>
                      <td className={`p-2 font-medium sm:p-3 ${isSelected && !indisponivel ? "text-blue-600" : ""}`}>
                        {frota.frota_geral ?? frota.id}
                      </td>
                      <td className={`p-2 sm:p-3 ${isSelected && !indisponivel ? "text-blue-600" : ""}`}>
                        {frota.placa ?? "-"}
                      </td>
                      <td className="hidden p-3 sm:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{frota.modelo ?? "-"}</span>
                          {bloqueada && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800 ring-1 ring-inset ring-violet-200">
                              EM MANUTENÇÃO
                            </span>
                          )}
                          {bloqueadaVenda && (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              INDISPONÍVEL
                            </span>
                          )}
                          {bloqueadaChecklist && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                              AGUARDE {minutosRestantes} MIN
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section hidden={step !== 1} className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1.5">
            <p className="font-medium">Inspecione o veículo e marque cada item.</p>
            <ul className="ml-1 list-disc space-y-0.5 pl-3 text-xs opacity-90">
              <li>
                Itens com <span className="font-semibold text-red-600">*</span> são obrigatórios — você precisa marcar OK ou Problema.
              </li>
              <li>
                Itens <span className="font-semibold text-red-700">críticos</span> (iluminação, freios, pneus) bloqueiam a saída se marcados como Problema.
              </li>
              <li>Itens não obrigatórios podem ficar sem marcação se não se aplicam.</li>
              <li>Ao marcar <span className="font-semibold">Problema</span>, descreva o que aconteceu na observação ao lado.</li>
            </ul>
          </div>
        </div>

        <div className="space-y-6 rounded-md border bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-6">
            <FuelLevelSelector
              label="Nível combustível"
              value={nivelCombustivel}
              onChange={setNivelCombustivel}
            />
            <FuelLevelSelector label="Nível arla" value={nivelArla} onChange={setNivelArla} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {CHECKLIST_ITEMS.map((item) => {
              const status = itemStatuses[item.codigo] ?? "NAO_SE_APLICA";
              const isApto = status === "APTO";
              const isProblem = status === "NAO_APTO";
              return (
                <div
                  key={item.codigo}
                  className={cn(
                    "space-y-2 rounded-md border bg-slate-50 p-3",
                    item.critico && "border-red-200 bg-red-50/40"
                  )}
                >
                  <div>
                    <div className="flex min-h-10 items-start">
                      <span className="text-sm font-medium leading-tight">
                      {item.nome}
                      {item.obrigatorio ? (
                        <span
                          className="ml-1 text-xs text-red-500"
                          title={item.critico ? "Item crítico (obrigatório)" : "Item obrigatório"}
                        >
                          *
                        </span>
                      ) : null}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide">
                      {item.critico ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 ring-1 ring-inset ring-red-200">
                          Crítico
                        </span>
                      ) : item.obrigatorio ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 ring-1 ring-inset ring-amber-200">
                          Obrigatório
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 ring-1 ring-inset ring-slate-200">
                          Opcional
                        </span>
                      )}
                      {item.critico && (
                        <span className="text-[10px] font-normal normal-case text-red-700/80">
                          Bloqueia saída se Problema
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={isApto}
                      onClick={() => setItemStatus(item.codigo, "APTO")}
                      className={`h-11 rounded-md border text-sm font-medium transition-colors sm:h-10 ${
                        isApto
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      aria-pressed={isProblem}
                      onClick={() => setItemStatus(item.codigo, "NAO_APTO")}
                      className={`h-11 rounded-md border text-sm font-medium transition-colors sm:h-10 ${
                        isProblem
                          ? "border-red-500 bg-red-50 text-red-800"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Problema
                    </button>
                  </div>

                  {status === "NAO_SE_APLICA" ? (
                    <p className="text-xs text-muted-foreground">Pendente de marcação.</p>
                  ) : null}

                  {isProblem ? (
                    <>
                      <p className="text-xs font-medium text-red-500">Problema identificado</p>
                      <Input
                        name={`item_observacao_${item.codigo}`}
                        placeholder="Descreva o problema..."
                        className="text-sm"
                        value={itemObservacoes[item.codigo] ?? ""}
                        onChange={(e) => {
                          setItemObservacoes((prev) => ({ ...prev, [item.codigo]: e.target.value }));
                          setStepErro(null);
                        }}
                      />
                      <label className="flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-white p-3 text-center text-xs text-muted-foreground transition-colors hover:bg-slate-50">
                        <Camera className="mb-1 h-4 w-4 text-blue-600" aria-hidden="true" />
                        {itemFotoNomes[item.codigo] ? (
                          <span className="line-clamp-2 font-medium text-slate-700">
                            {itemFotoNomes[item.codigo]}
                          </span>
                        ) : (
                          "Anexar foto do problema"
                        )}
                        <input
                          name={`item_foto_${item.codigo}`}
                          type="file"
                          accept={IMAGE_ACCEPT}
                          capture="environment"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setItemFotoNomes((prev) => ({
                              ...prev,
                              [item.codigo]: file?.name ?? "",
                            }));
                            setStepErro(null);
                          }}
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>

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
        </div>

        {stepErro && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
            {stepErro}
          </div>
        )}

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => { setStep(0); setStepErro(null); }}>
            Voltar
          </Button>
          <Button type="button" onClick={avancarParaStep2}>
            Prosseguir
            <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </section>

      <section hidden={step !== 2} className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">Registre o hodômetro e (se aplicável) o abastecimento.</p>
            <p className="text-xs opacity-90">
              Tire a foto do painel com o hodômetro nítido — a IA lê automaticamente, mas você pode
              ajustar o valor se necessário. Os campos de abastecimento são opcionais; só preencha
              se houve abastecimento neste turno.
            </p>
          </div>
        </div>
        <div className="space-y-5 rounded-md border bg-white p-5 shadow-sm">
          {selected && selected.km_atual == null && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Primeiro KM desta frota.</strong> Foto do hodômetro é obrigatória. O valor será
              registrado como KM inicial e validado pelo administrador.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="foto_km">Foto do painel / hodômetro</Label>
            <label className={cn(
              "relative flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-slate-50 text-center text-sm text-muted-foreground hover:bg-slate-100 transition-colors overflow-hidden",
              fotoKmPreview ? "min-h-0 p-0 border-blue-200" : "min-h-36 p-4"
            )}>
              {fotoKmPreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fotoKmPreview}
                    alt="Preview do painel"
                    className="w-full max-h-72 object-contain rounded-md bg-slate-100"
                  />
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
                    Trocar foto
                  </span>
                </>
              ) : (
                <>
                  <Camera className="mb-2 h-6 w-6 text-blue-600" aria-hidden="true" />
                  Tirar foto ou anexar imagem
                </>
              )}
              <input
                id="foto_km"
                name="foto_km"
                type="file"
                accept={IMAGE_ACCEPT}
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
              <OcrStatusCard
                ocrState={ocrState}
                kmAnterior={selected?.km_atual ?? null}
                onSelectCandidato={(km) => setKmValue(String(km))}
              />
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="km_informado">Quilometragem atual</Label>
              <Input
                id="km_informado"
                name="km_informado"
                type="number"
                min={0}
                inputMode="numeric"
                
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

          <div className="space-y-3 rounded-md border bg-slate-50 p-4">
            <p className="text-sm font-medium">Abastecimento (opcional)</p>
            <p className="text-xs text-muted-foreground">Preencha apenas se houve abastecimento neste turno.</p>
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
                  accept={IMAGE_ACCEPT}
                  capture="environment"
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>

        {stepErro && step === 2 && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
            {stepErro}
          </div>
        )}

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => { setStep(1); setStepErro(null); }}>
            Voltar
          </Button>
          <SubmitButton blocked={ocrDivergente && !kmManualPreenchido} />
        </div>
      </section>
    </form>
  );
}

function SubmitButton({ blocked }: { blocked?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || blocked}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Send className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      {pending ? "Enviando..." : blocked ? "Corrija o KM antes de enviar" : "Enviar checklist"}
    </Button>
  );
}

function OcrStatusCard({
  ocrState,
  kmAnterior,
  onSelectCandidato,
}: {
  ocrState: OcrState;
  kmAnterior: number | null;
  onSelectCandidato?: (km: number) => void;
}) {
  const status = ocrState.status_leitura ?? (ocrState.leitura_segura ? "LEITURA_SEGURA" : "LEITURA_FALHOU");
  const confiancaPct = Math.round(ocrState.confianca * 100);

  if (status === "LEITURA_SEGURA") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <div className="flex items-center gap-1.5 font-semibold">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          KM identificado: {formatNumber(ocrState.km_lido)} km
          <span className="ml-auto text-[11px] font-normal opacity-70">confiança {confiancaPct}%</span>
        </div>
        {ocrState.motivo && <p className="mt-1 text-xs opacity-80">{ocrState.motivo}</p>}
      </div>
    );
  }

  if (status === "LEITURA_SUSPEITA") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <div className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Leitura suspeita — confirme o valor
          <span className="ml-auto text-[11px] font-normal opacity-70">confiança {confiancaPct}%</span>
        </div>
        {ocrState.km_lido != null && (
          <p className="mt-1 text-xs">
            IA leu: <strong>{formatNumber(ocrState.km_lido)} km</strong>
            {kmAnterior != null && (
              <span className="ml-1 opacity-70">(último registrado: {formatNumber(kmAnterior)} km)</span>
            )}
          </p>
        )}
        {ocrState.motivo && <p className="mt-1 text-xs opacity-80">{ocrState.motivo}</p>}
        <p className="mt-1.5 text-xs font-medium">Verifique o painel e corrija o KM se necessário.</p>
      </div>
    );
  }

  if (status === "LEITURA_DIVERGENTE") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        <div className="flex items-center gap-1.5 font-semibold">
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Leitura inconsistente — digite o KM manualmente
        </div>
        {/* Comparação visual lado a lado */}
        {(ocrState.km_lido != null || kmAnterior != null) && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ocrState.km_lido != null && (
              <div className="rounded-md bg-red-100 px-2 py-1.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">IA leu</p>
                <p className="text-base font-bold tabular-nums">{formatNumber(ocrState.km_lido)} km</p>
              </div>
            )}
            {kmAnterior != null && (
              <div className="rounded-md bg-white/60 px-2 py-1.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Último registrado</p>
                <p className="text-base font-bold tabular-nums">{formatNumber(kmAnterior)} km</p>
              </div>
            )}
          </div>
        )}
        {ocrState.km_lido == null && (
          <p className="mt-1 text-xs">Não foi possível ler a quilometragem.</p>
        )}
        {ocrState.candidatos_descartados && ocrState.candidatos_descartados.length > 0 && (
          <div className="mt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
              Outros valores detectados — clique se for o correto:
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ocrState.candidatos_descartados.map((c, i) => (
                <button
                  key={`${c.valor}-${i}`}
                  type="button"
                  onClick={() => onSelectCandidato?.(c.valor)}
                  title={c.motivo}
                  className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-800 transition-colors hover:border-red-500 hover:bg-red-100"
                >
                  {formatNumber(c.valor)} km
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="mt-2 text-xs font-medium text-red-800">
          Selecione um dos valores acima ou digite o KM manualmente.
        </p>
      </div>
    );
  }

  // LEITURA_FALHOU
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
      <div className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="h-4 w-4 text-slate-400" aria-hidden="true" />
        Não foi possível ler a quilometragem
      </div>
      {ocrState.motivo && <p className="mt-1 text-xs opacity-80">{ocrState.motivo}</p>}
      <p className="mt-1.5 text-xs">Digite o KM manualmente no campo abaixo.</p>
    </div>
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

  const toneFor = (lvl: number) => {
    if (lvl === 1) {
      return {
        fill: "bg-red-400 shadow-sm shadow-red-200",
        preview: "bg-red-200",
      };
    }
    if (lvl === 2) {
      return {
        fill: "bg-amber-400 shadow-sm shadow-amber-200",
        preview: "bg-amber-200",
      };
    }
    if (lvl === 3) {
      return {
        fill: "bg-blue-400 shadow-sm shadow-blue-200",
        preview: "bg-blue-200",
      };
    }
    return {
      fill: "bg-emerald-400 shadow-sm shadow-emerald-200",
      preview: "bg-emerald-200",
    };
  };

  const labelTone = (lvl: number) => {
    if (lvl === 1) return "text-red-600 font-semibold";
    if (lvl === 2) return "text-amber-600 font-semibold";
    if (lvl === 3) return "text-blue-600 font-semibold";
    if (lvl === 4) return "text-emerald-600 font-semibold";
    return "text-muted-foreground";
  };

  const activeLevel = value > 0 ? value : hovered;
  const activeTone = activeLevel > 0 ? toneFor(activeLevel) : null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>

      {/* Track de fundo + pílulas interativas */}
      <div className="relative flex gap-1.5 rounded-full bg-slate-100 p-1">
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
              className={cn(
                "h-7 flex-1 rounded-full transition-all duration-150",
                filled && activeTone
                  ? activeTone.fill
                  : previewed
                    ? toneFor(hovered).preview
                    : "bg-transparent hover:bg-slate-200"
              )}
              aria-label={`${level}/4 do tanque`}
            />
          );
        })}
      </div>

      <p className={`text-xs ${labelTone(activeLevel)}`}>
        {value === 0
          ? hovered > 0
            ? `${hovered}/4`
            : "Não informado"
          : `${value}/4${value === 1 ? " · Baixo" : value === 4 ? " · Cheio" : ""}`}
      </p>
    </div>
  );
}
