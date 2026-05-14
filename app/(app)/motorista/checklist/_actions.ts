"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CHECKLIST_ITEMS, type ChecklistStatusItem } from "@/lib/checklists/catalog";
import { analyzeOdometerImage } from "@/lib/ai/odometer";
import {
  itemNeedsEvidence,
  normalizeDriverNote,
  statusGeralFromItems,
  validateKm,
} from "@/lib/checklists/rules";
import { createChecklist } from "@/lib/repos/checklists";
import { getFrota } from "@/lib/repos/frotas";
import { requireAppUser } from "@/lib/rbac";
import { fileFromForm, pendingStorageUrl, validateImageFile } from "@/lib/upload-validation";

const StatusSchema = z.enum(["APTO", "NAO_APTO", "NAO_SE_APLICA"]);

function optionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validateImage(file: File | null, label: string): string | null {
  validateImageFile(file, label);
  return pendingStorageUrl(file);
}

const TipoCombustivelSchema = z
  .enum(["DIESEL_S10", "DIESEL_S500", "GASOLINA", "ETANOL", "GNV", "ARLA"])
  .optional()
  .nullable();

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

export async function enviarChecklistMotoristaAction(formData: FormData) {
  const user = await requireAppUser();
  const frotaId = z.coerce.number().int().positive().parse(formData.get("frota_id"));
  const kmDigitado = optionalInteger(formData.get("km_informado"));
  const justificativaKm = optionalText(formData.get("justificativa_km"));
  const observacaoOriginal = optionalText(formData.get("observacao_original"));
  const fotoKmFile = fileFromForm(formData.get("foto_km"));
  const fotoKmUrl = validateImage(fotoKmFile, "Foto do hodômetro");

  if (!fotoKmUrl) {
    throw new Error("A foto do hodômetro é obrigatória para comprovar o KM.");
  }

  const leituraKm = fotoKmFile ? await analyzeOdometerImage(fotoKmFile) : null;
  const kmInformado =
    kmDigitado ??
    (leituraKm?.leitura_segura && leituraKm.km_lido != null ? leituraKm.km_lido : null);

  if (kmInformado == null) {
    throw new Error("Não conseguimos ler a quilometragem com segurança. Digite o KM manualmente.");
  }

  const tipoCombustivelRaw = optionalText(formData.get("tipo_combustivel"));
  const tipoCombustivel = TipoCombustivelSchema.parse(tipoCombustivelRaw ?? undefined) ?? null;
  const litrosCombustivel = optionalDecimal(formData.get("litros_combustivel"));
  const litrosArla = optionalDecimal(formData.get("litros_arla"));
  const fotoComprovanteUrl = validateImage(
    fileFromForm(formData.get("foto_comprovante")),
    "Foto do comprovante"
  );

  const frota = await getFrota(frotaId);
  if (!frota || !frota.ativo || frota.vendido) throw new Error("Frota indisponível para checklist.");

  const kmValidation = validateKm(kmInformado, frota.km_atual, justificativaKm);
  if (!kmValidation.ok) {
    throw new Error(
      kmValidation.reason === "MENOR_QUE_ULTIMO"
        ? "O KM informado e menor que o ultimo registrado. Informe uma justificativa."
        : "A variação de KM está incomum. Informe uma justificativa."
    );
  }

  const itens = CHECKLIST_ITEMS.map((catalogItem) => {
    const status = StatusSchema.parse(formData.get(`item_status_${catalogItem.codigo}`)) as ChecklistStatusItem;
    const observacao = optionalText(formData.get(`item_observacao_${catalogItem.codigo}`));
    const foto_url = validateImage(fileFromForm(formData.get(`item_foto_${catalogItem.codigo}`)), catalogItem.nome);
    return { catalogItem, status, observacao, hasFoto: Boolean(foto_url), foto_url };
  });

  const missingEvidence = itens.find(itemNeedsEvidence);
  if (missingEvidence) {
    throw new Error(`${missingEvidence.catalogItem.nome}: informe observação ou anexe foto ao marcar Não apto.`);
  }

  const statusGeral = statusGeralFromItems(itens, observacaoOriginal);
  const observacaoCorrigida = normalizeDriverNote(observacaoOriginal);
  const observacaoComKm =
    kmValidation.diff != null && justificativaKm
      ? `${observacaoOriginal ?? ""}\nKM: ultimo=${frota.km_atual}; informado=${kmInformado}; diferenca=${kmValidation.diff}; justificativa=${justificativaKm}`.trim()
      : observacaoOriginal;

  await createChecklist({
    frota_id: frotaId,
    motorista_id: user.email,
    motorista_nome: user.name,
    km_informado: kmInformado,
    km_lido_ocr: leituraKm?.km_lido ?? null,
    ocr_confianca: leituraKm?.confianca ?? null,
    km_confirmado: kmDigitado != null || Boolean(leituraKm?.km_lido === kmInformado && leituraKm.leitura_segura),
    foto_km_url: fotoKmUrl,
    status_geral: statusGeral,
    observacao_original: observacaoComKm,
    observacao_corrigida_ia: observacaoCorrigida,
    itens: itens.map((item) => ({
      item_codigo: item.catalogItem.codigo,
      status: item.status,
      observacao: item.observacao,
      foto_url: item.foto_url,
    })),
    tipo_combustivel: tipoCombustivel,
    litros_combustivel: litrosCombustivel,
    litros_arla: litrosArla,
    foto_comprovante_abastecimento_url: fotoComprovanteUrl,
  });

  revalidatePath("/motorista");
  revalidatePath("/motorista/checklists");
  revalidatePath("/checklists");
  revalidatePath("/pendencias");
  redirect("/motorista/checklists");
}
