"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { analyzeOdometerImage } from "@/lib/ai/odometer";
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

const StatusSchema = z.enum(["APTO", "NAO_APTO", "NAO_SE_APLICA"]);

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

function validateImage(file: File | null, label: string): File | null {
  validateImageFile(file, label);
  return file;
}

export async function enviarChecklistMotoristaAction(formData: FormData) {
  const user = await requireAppUser();
  const frotaId = z.coerce.number().int().positive().parse(formData.get("frota_id"));
  const kmDigitado = optionalInteger(formData.get("km_informado"));
  const justificativaKm = optionalText(formData.get("justificativa_km"));
  const observacaoOriginal = optionalText(formData.get("observacao_original"));

  const fotoKm = validateImage(fileFromForm(formData.get("foto_km")), "Foto do hodometro");
  if (!fotoKm) {
    throw new Error("A foto do hodometro e obrigatoria para comprovar o KM.");
  }

  const leituraKm = await analyzeOdometerImage(fotoKm);
  const kmInformado =
    kmDigitado ??
    (leituraKm.leitura_segura && leituraKm.km_lido != null ? leituraKm.km_lido : null);

  if (kmInformado == null) {
    throw new Error("Nao conseguimos ler a quilometragem com seguranca. Digite o KM manualmente.");
  }

  const tipoCombustivelRaw = optionalText(formData.get("tipo_combustivel"));
  const tipoCombustivel = TipoCombustivelSchema.parse(tipoCombustivelRaw ?? undefined) ?? null;
  const litrosCombustivel = optionalDecimal(formData.get("litros_combustivel"));
  const litrosArla = optionalDecimal(formData.get("litros_arla"));
  const fotoComprovante = validateImage(
    fileFromForm(formData.get("foto_comprovante")),
    "Foto do comprovante"
  );

  const frota = await getFrota(frotaId);
  if (!frota || !frota.ativo || frota.vendido) throw new Error("Frota indisponivel para checklist.");

  const kmValidation = validateKm(kmInformado, frota.km_atual, justificativaKm);
  if (!kmValidation.ok) {
    throw new Error(
      kmValidation.reason === "MENOR_QUE_ULTIMO"
        ? "O KM informado e menor que o ultimo registrado. Informe uma justificativa."
        : "A variacao de KM esta incomum. Informe uma justificativa."
    );
  }

  const itensDraft = CHECKLIST_ITEMS.map((catalogItem) => {
    const status = StatusSchema.parse(formData.get(`item_status_${catalogItem.codigo}`)) as ChecklistStatusItem;
    const observacao = optionalText(formData.get(`item_observacao_${catalogItem.codigo}`));
    const foto = validateImage(fileFromForm(formData.get(`item_foto_${catalogItem.codigo}`)), catalogItem.nome);
    return { catalogItem, status, observacao, hasFoto: Boolean(foto), foto };
  });

  const missingEvidence = itensDraft.find(itemNeedsEvidence);
  if (missingEvidence) {
    throw new Error(`${missingEvidence.catalogItem.nome}: informe observacao ou anexe foto ao marcar Nao apto.`);
  }

  const statusGeral = statusGeralFromItems(itensDraft, observacaoOriginal);
  const observacaoCorrigida = normalizeDriverNote(observacaoOriginal);
  const observacaoComKm =
    kmValidation.diff != null && justificativaKm
      ? `${observacaoOriginal ?? ""}\nKM: ultimo=${frota.km_atual}; informado=${kmInformado}; diferenca=${kmValidation.diff}; justificativa=${justificativaKm}`.trim()
      : observacaoOriginal;

  const uploadedPaths: string[] = [];
  const inspections: Omit<ChecklistImageInspectionInput, "checklist_id">[] = [];

  try {
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

    const itens = [];
    for (const item of itensDraft) {
      const fotoUrl = item.foto
        ? await uploadChecklistImage(item.foto, {
            frotaId,
            sourceType: "item",
            itemCodigo: item.catalogItem.codigo,
          })
        : null;

      if (fotoUrl) {
        uploadedPaths.push(fotoUrl);
        inspections.push({
          checklist_item_codigo: item.catalogItem.codigo,
          source_type: "item",
          storage_path: fotoUrl,
        });
      }

      itens.push({
        item_codigo: item.catalogItem.codigo,
        status: item.status,
        observacao: item.observacao,
        foto_url: fotoUrl,
      });
    }

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
      observacao_original: observacaoComKm,
      observacao_corrigida_ia: observacaoCorrigida,
      itens,
      tipo_combustivel: tipoCombustivel,
      litros_combustivel: litrosCombustivel,
      litros_arla: litrosArla,
      foto_comprovante_abastecimento_url: fotoComprovanteUrl,
    });

    await createChecklistImageInspections(
      inspections.map((inspection) => ({
        ...inspection,
        checklist_id: result.checklist_id,
      }))
    ).catch((error) => {
      console.warn("[vision] falha ao criar fila de inspecao", error);
    });
  } catch (error) {
    await removeChecklistImages(uploadedPaths).catch((cleanupError) => {
      console.warn("[checklists] falha ao limpar imagens apos erro", cleanupError);
    });
    throw error;
  }

  revalidatePath("/motorista");
  revalidatePath("/motorista/checklists");
  revalidatePath("/checklists");
  revalidatePath("/pendencias");
  redirect("/motorista/checklists");
}
