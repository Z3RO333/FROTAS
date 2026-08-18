"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canWriteDocumentos, requireAppUser } from "@/lib/rbac";
import {
  createDocument,
  deleteDocument,
  getDocumentByFrotaPlaca,
  getDocumentById,
  removeDocumentFiles,
  replaceDocumentFiles,
  updateDocument,
  uploadDocumentFile,
} from "@/lib/repos/manutencao/documents";
import { validateAggregateFileSize, validatePdfFile } from "@/lib/upload-validation";
import { publicActionError } from "@/lib/public-error";
import { readCrlvVencimento } from "@/lib/ai/crlv-ocr";
import { resolveCrlvVencimento } from "@/lib/ai/resolve-crlv-vencimento";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const optionalDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || DATE_RE.test(v), { message: "Data inválida" });

const DocumentSchema = z.object({
  frota: z.string().trim().min(1, "Frota obrigatória"),
  placa: z.string().trim().min(1, "Placa obrigatória"),
  modelo: z.string().trim().min(1, "Modelo obrigatório"),
  dut_vencimento: optionalDate,
  crlv_vencimento: optionalDate,
});

export type DocumentActionResult = { ok: true } | { ok: false; error: string };

export async function createDocumentAction(formData: FormData): Promise<DocumentActionResult> {
  const user = await requireAppUser();
  if (!canWriteDocumentos(user.perfil)) redirect("/");

  try {
    const input = DocumentSchema.parse(readDocumentFields(formData));
    const dutFile = readOptionalFile(formData, "dut_file");
    const crlvFile = readOptionalFile(formData, "crlv_file");

    if (!dutFile && !crlvFile) {
      return { ok: false, error: "Envie ao menos um PDF de DUT ou CRLV." };
    }

    await validatePdfFile(dutFile, "DUT");
    await validatePdfFile(crlvFile, "CRLV");

    const crlvResolved = crlvFile
      ? resolveCrlvVencimento(
          await readCrlvVencimento(Buffer.from(await crlvFile.arrayBuffer())),
          input.crlv_vencimento
        )
      : {
          crlv_vencimento: input.crlv_vencimento,
          crlv_vencimento_origem: input.crlv_vencimento ? ("MANUAL" as const) : null,
          crlv_vencimento_confianca: null,
          crlv_revisar_manualmente: false,
        };

    validateAggregateFileSize([dutFile, crlvFile], 20 * 1024 * 1024, "Documentos");

    const placa = normalizePlate(input.placa);

    // Já existe documento pra essa frota/placa? Atualiza em vez de duplicar
    // (era assim que a Central de Documentos acumulava linhas repetidas —
    // CRLV numa linha, DUT numa segunda linha da mesma frota).
    const existing = await getDocumentByFrotaPlaca(input.frota, placa);
    if (existing) {
      const replacement = await replaceDocumentFiles(existing, { dut: dutFile, crlv: crlvFile }, placa);
      try {
        await updateDocument(existing.id, {
          modelo: input.modelo,
          placa,
          dut_url: replacement.dut_url,
          crlv_url: replacement.crlv_url,
          dut_vencimento: input.dut_vencimento,
          ...crlvResolved,
        });
      } catch (error) {
        await removeDocumentFiles(replacement.uploadedPaths).catch((cleanupError) => {
          console.error("[documents] falha ao limpar arquivos após erro de atualização", cleanupError);
        });
        throw error;
      }
      await removeDocumentFiles(replacement.oldPaths).catch((cleanupError) => {
        console.error("[documents] documento atualizado, mas arquivo antigo ficou órfão", cleanupError);
      });
      revalidatePath("/documentos");
      return { ok: true };
    }

    const uploadedPaths: string[] = [];
    try {
      const dutPath = dutFile ? await uploadDocumentFile(dutFile, placa, "dut") : null;
      if (dutPath) uploadedPaths.push(dutPath);

      const crlvPath = crlvFile ? await uploadDocumentFile(crlvFile, placa, "crlv") : null;
      if (crlvPath) uploadedPaths.push(crlvPath);

      await createDocument(
        {
          ...input,
          placa,
          dut_url: dutPath,
          crlv_url: crlvPath,
          ...crlvResolved,
        },
        user.email
      );
    } catch (error) {
      await removeDocumentFiles(uploadedPaths).catch((cleanupError) => {
        console.error("[documents] falha ao limpar arquivos após erro de criação", cleanupError);
      });
      throw error;
    }

    revalidatePath("/documentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getActionErrorMessage(error) };
  }
}

export async function updateDocumentAction(id: string, formData: FormData): Promise<DocumentActionResult> {
  const user = await requireAppUser();
  if (!canWriteDocumentos(user.perfil)) redirect("/");

  try {
    const current = await getDocumentById(id);
    if (!current) return { ok: false, error: "Documento não encontrado." };

    const input = DocumentSchema.partial().parse(readDocumentFields(formData));
    const dutFile = readOptionalFile(formData, "dut_file");
    const crlvFile = readOptionalFile(formData, "crlv_file");

    await validatePdfFile(dutFile, "DUT");
    await validatePdfFile(crlvFile, "CRLV");

    const crlvResolved = crlvFile
      ? resolveCrlvVencimento(
          await readCrlvVencimento(Buffer.from(await crlvFile.arrayBuffer())),
          input.crlv_vencimento ?? current.crlv_vencimento
        )
      : undefined;

    validateAggregateFileSize([dutFile, crlvFile], 20 * 1024 * 1024, "Documentos");

    const placa = input.placa ?? current.placa;

    const replacement = await replaceDocumentFiles(current, { dut: dutFile, crlv: crlvFile }, placa);

    try {
      await updateDocument(id, {
        ...input,
        placa: input.placa ? normalizePlate(input.placa) : undefined,
        dut_url: replacement.dut_url,
        crlv_url: replacement.crlv_url,
        ...crlvResolved,
      });
    } catch (error) {
      await removeDocumentFiles(replacement.uploadedPaths).catch((cleanupError) => {
        console.error("[documents] falha ao limpar arquivos após erro de atualização", cleanupError);
      });
      throw error;
    }

    await removeDocumentFiles(replacement.oldPaths).catch((cleanupError) => {
      console.error("[documents] documento atualizado, mas arquivo antigo ficou órfão", cleanupError);
    });

    revalidatePath("/documentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getActionErrorMessage(error) };
  }
}

export async function deleteDocumentAction(id: string): Promise<DocumentActionResult> {
  const user = await requireAppUser();
  if (!canWriteDocumentos(user.perfil)) redirect("/");

  try {
    await deleteDocument(id);
    revalidatePath("/documentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getActionErrorMessage(error) };
  }
}

function readDocumentFields(formData: FormData) {
  return {
    frota: String(formData.get("frota") ?? ""),
    placa: String(formData.get("placa") ?? ""),
    modelo: String(formData.get("modelo") ?? ""),
    dut_vencimento: formData.get("dut_vencimento") ? String(formData.get("dut_vencimento")) : null,
    crlv_vencimento: formData.get("crlv_vencimento") ? String(formData.get("crlv_vencimento")) : null,
  };
}

function readOptionalFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  if (!value || typeof value === "string" || value.size === 0) return null;
  return value;
}

function normalizePlate(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getActionErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Dados inválidos.";
  return publicActionError(error, "Erro inesperado ao processar documento.");
}
