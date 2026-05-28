"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { analyzeOdometerImage, type OdometerReading } from "@/lib/ai/odometer";
import { CHECKLIST_ITEMS, type ChecklistStatusItem } from "@/lib/checklists/catalog";
import {
  itemNeedsEvidence,
  normalizeDriverNote,
  statusGeralFromItems,
  validateKm,
} from "@/lib/checklists/rules";
import {
  createChecklistImageInspections,
  removeChecklistImages,
  uploadChecklistImage,
  type ChecklistImageInspectionInput,
} from "@/lib/repos/checklist-images";
import { createChecklist } from "@/lib/repos/checklists";
import { getFrota } from "@/lib/repos/frotas";
import { requireAppUser } from "@/lib/rbac";
import { fileFromForm, validateImageFile } from "@/lib/upload-validation";

// Tipos e constantes movidos para types.ts (arquivos "use server" só exportam funções async)
export type { ChecklistMotoristaActionState } from "./types";
import type { ChecklistMotoristaActionState } from "./types";

const StatusSchema = z.enum(["APTO", "NAO_APTO", "NAO_SE_APLICA"]);

// Threshold mínimo de confiança do OCR para aceitar leitura automática.
// Mantido em sincronia com o limiar do cliente em /api/checklists/ocr-km.
const OCR_MIN_CONFIDENCE = 0.85;

const TipoCombustivelSchema = z
  .enum(["DIESEL_S10", "DIESEL_S500", "GASOLINA", "ETANOL", "GNV", "ARLA"])
  .optional()
  .nullable();

function optionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalDecimal(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function optionalInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

async function validateImage(file: File | null, label: string): Promise<File | null> {
  await validateImageFile(file, label);
  return file;
}

export async function enviarChecklistMotoristaAction(
  _prevState: ChecklistMotoristaActionState,
  formData: FormData
): Promise<ChecklistMotoristaActionState> {
  const user = await requireAppUser();
  const uploadedPaths: string[] = [];

  try {
    const frotaId = z.coerce
      .number()
      .int()
      .positive("Selecione uma frota para enviar o checklist.")
      .parse(formData.get("frota_id"));
    const kmDigitado = optionalInteger(formData.get("km_informado"));
    const justificativaKm = optionalText(formData.get("justificativa_km"));
    const observacaoOriginal = optionalText(formData.get("observacao_original"));

    const fotoKm = await validateImage(fileFromForm(formData.get("foto_km")), "Foto do hodômetro");
    if (!fotoKm) {
      throw new Error("A foto do hodômetro é obrigatória para comprovar o KM.");
    }

    // Reutiliza resultado do OCR feito no cliente, mas REAVALIA a confiança no servidor.
    // O cliente envia km_lido e confiança; o servidor decide se a leitura é segura.
    // Não confiar no flag "ocr_leitura_segura" do cliente — vetor de bypass conhecido.
    const ocrKmLidoRaw = optionalInteger(formData.get("ocr_km_lido"));
    const ocrConfiancaRaw = optionalDecimal(formData.get("ocr_confianca"));
    const confianca =
      ocrConfiancaRaw != null && ocrConfiancaRaw >= 0 && ocrConfiancaRaw <= 1
        ? ocrConfiancaRaw
        : 0;
    const leituraSeguraServidor =
      ocrKmLidoRaw != null && confianca >= OCR_MIN_CONFIDENCE;

    const leituraKm: OdometerReading = {
      km_lido: ocrKmLidoRaw,
      confianca,
      leitura_segura: leituraSeguraServidor,
      precisa_digitacao_manual: !leituraSeguraServidor,
      motivo: null,
      texto_visivel: null,
      candidatos_descartados: [],
      regiao_detectada: "desconhecido",
    };

    const kmInformado =
      kmDigitado ??
      (leituraKm.leitura_segura && leituraKm.km_lido != null ? leituraKm.km_lido : null);

    if (kmInformado == null) {
      throw new Error("Não conseguimos ler a quilometragem com segurança. Digite o KM manualmente.");
    }

    const tipoCombustivelRaw = optionalText(formData.get("tipo_combustivel"));
    const tipoCombustivel = TipoCombustivelSchema.parse(tipoCombustivelRaw ?? undefined) ?? null;
    const litrosCombustivel = optionalDecimal(formData.get("litros_combustivel"));
    const litrosArla = optionalDecimal(formData.get("litros_arla"));

    // Abastecimento é opcional, mas se houver litros precisa do tipo de combustível.
    // Arla é tratado como combustível à parte (tipo "ARLA").
    if ((litrosCombustivel ?? 0) > 0 && !tipoCombustivel) {
      throw new Error("Informe o tipo de combustível para registrar o abastecimento.");
    }
    if ((litrosArla ?? 0) > 0 && tipoCombustivel === "ARLA" && (litrosCombustivel ?? 0) > 0) {
      throw new Error("Para registrar Arla, deixe os litros de combustível em branco ou escolha outro tipo.");
    }
    const nivelCombustivelRaw = optionalInteger(formData.get("nivel_combustivel"));
    const nivelArlaRaw = optionalInteger(formData.get("nivel_arla"));
    const nivelCombustivel =
      nivelCombustivelRaw != null && nivelCombustivelRaw >= 0 && nivelCombustivelRaw <= 4
        ? nivelCombustivelRaw
        : null;
    const nivelArla =
      nivelArlaRaw != null && nivelArlaRaw >= 0 && nivelArlaRaw <= 4 ? nivelArlaRaw : null;
    const fotoComprovante = await validateImage(
      fileFromForm(formData.get("foto_comprovante")),
      "Foto do comprovante"
    );

    const frota = await getFrota(frotaId);
    if (!frota || !frota.ativo || frota.vendido) throw new Error("Frota indisponível para checklist.");

    const kmValidation = validateKm(kmInformado, frota.km_atual, justificativaKm);
    if (!kmValidation.ok) {
      throw new Error(
        kmValidation.reason === "MENOR_QUE_ULTIMO"
          ? "O KM informado é menor que o último registrado. Informe uma justificativa."
          : "A variação de KM está incomum. Informe uma justificativa."
      );
    }

    const itensDraft = await Promise.all(
      CHECKLIST_ITEMS.map(async (catalogItem) => {
        const status = StatusSchema.parse(formData.get(`item_status_${catalogItem.codigo}`)) as ChecklistStatusItem;
        const observacao = optionalText(formData.get(`item_observacao_${catalogItem.codigo}`));
        const foto = await validateImage(fileFromForm(formData.get(`item_foto_${catalogItem.codigo}`)), catalogItem.nome);
        return { catalogItem, status, observacao, hasFoto: Boolean(foto), foto };
      })
    );

    const missingRequired = itensDraft.find(
      (item) => item.catalogItem.obrigatorio && item.status === "NAO_SE_APLICA"
    );
    if (missingRequired) {
      throw new Error(`${missingRequired.catalogItem.nome}: marque OK ou Problema antes de enviar.`);
    }

    const missingEvidence = itensDraft.find(itemNeedsEvidence);
    if (missingEvidence) {
      throw new Error(`${missingEvidence.catalogItem.nome}: informe observação ou anexe foto ao marcar Problema.`);
    }

    const statusGeral = statusGeralFromItems(itensDraft, observacaoOriginal);
    const observacaoCorrigida = normalizeDriverNote(observacaoOriginal);
    const inspections: Omit<ChecklistImageInspectionInput, "checklist_id">[] = [];

    const fotoKmUrl = await uploadChecklistImage(fotoKm, { frotaId, sourceType: "hodometro" });
    uploadedPaths.push(fotoKmUrl);
    inspections.push({ source_type: "hodometro", storage_path: fotoKmUrl });

    const fotoComprovanteUrl = fotoComprovante
      ? await uploadChecklistImage(fotoComprovante, { frotaId, sourceType: "abastecimento" })
      : null;
    if (fotoComprovanteUrl) {
      uploadedPaths.push(fotoComprovanteUrl);
      inspections.push({ source_type: "abastecimento", storage_path: fotoComprovanteUrl });
    }

    // Uploads de itens em paralelo — antes era sequencial (somava ~500ms por foto)
    const itensComUpload = await Promise.all(
      itensDraft.map(async (item) => {
        const fotoUrl = item.foto
          ? await uploadChecklistImage(item.foto, {
              frotaId,
              sourceType: "item",
              itemCodigo: item.catalogItem.codigo,
            })
          : null;
        return { item, fotoUrl };
      })
    );

    const itens = itensComUpload.map(({ item, fotoUrl }) => {
      if (fotoUrl) {
        uploadedPaths.push(fotoUrl);
        inspections.push({
          checklist_item_codigo: item.catalogItem.codigo,
          source_type: "item",
          storage_path: fotoUrl,
        });
      }
      return {
        item_codigo: item.catalogItem.codigo,
        status: item.status,
        observacao: item.observacao,
        foto_url: fotoUrl,
      };
    });

    const result = await createChecklist({
      frota_id: frotaId,
      motorista_id: user.email,
      motorista_nome: user.name,
      km_informado: kmInformado,
      km_lido_ocr: leituraKm.km_lido ?? null,
      ocr_confianca: leituraKm.confianca ?? null,
      km_confirmado: kmDigitado != null || Boolean(leituraKm.km_lido === kmInformado && leituraKm.leitura_segura),
      foto_km_url: fotoKmUrl,
      status_geral: statusGeral,
      observacao_original: observacaoOriginal,
      observacao_corrigida_ia: observacaoCorrigida,
      itens,
      tipo_combustivel: tipoCombustivel,
      litros_combustivel: litrosCombustivel,
      litros_arla: litrosArla,
      nivel_combustivel: nivelCombustivel,
      nivel_arla: nivelArla,
      foto_comprovante_abastecimento_url: fotoComprovanteUrl,
    });

    // A fila de inspeção alimenta a análise de IA. Falha aqui não bloqueia o motorista,
    // mas é logada com o checklist_id para reprocessamento manual posterior.
    // (createChecklist já dispara /api/checklists/analyze — não disparar de novo aqui.)
    await createChecklistImageInspections(
      inspections.map((inspection) => ({
        ...inspection,
        checklist_id: result.checklist_id,
      }))
    ).catch((error) => {
      console.warn(
        `[vision] falha ao criar fila de inspeção checklist_id=${result.checklist_id}`,
        error
      );
    });
  } catch (error) {
    await removeChecklistImages(uploadedPaths).catch((cleanupError) => {
      console.warn("[checklists] falha ao limpar imagens após erro", cleanupError);
    });
    return { ok: false, error: getChecklistActionErrorMessage(error) };
  }

  revalidatePath("/motorista");
  revalidatePath("/motorista/checklists");
  revalidatePath("/checklists");
  revalidatePath("/pendencias");
  return { ok: true, redirectTo: "/motorista/checklists" };
}

function getChecklistActionErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Dados inválidos no checklist.";
  if (error instanceof Error) return error.message;
  return "Não foi possível enviar o checklist.";
}
