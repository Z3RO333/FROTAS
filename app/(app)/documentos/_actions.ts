"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canWriteDocumentos, requireAppUser } from "@/lib/rbac";
import { createDocument, deleteDocument, updateDocument } from "@/lib/repos/manutencao/documents";

const DocumentSchema = z.object({
  frota: z.string().min(1, "Frota obrigatória"),
  placa: z.string().min(1, "Placa obrigatória"),
  modelo: z.string().min(1, "Modelo obrigatório"),
  dut_url: z.string().url("URL DUT inválida"),
  crlv_url: z.string().url("URL CRLV inválida"),
});

export async function createDocumentAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canWriteDocumentos(user.perfil)) redirect("/");
  const input = DocumentSchema.parse(Object.fromEntries(formData));
  await createDocument(input, user.email);
  revalidatePath("/documentos");
}

export async function updateDocumentAction(id: string, formData: FormData) {
  const user = await requireAppUser();
  if (!canWriteDocumentos(user.perfil)) redirect("/");
  const input = DocumentSchema.partial().parse(Object.fromEntries(formData));
  await updateDocument(id, input);
  revalidatePath("/documentos");
}

export async function deleteDocumentAction(id: string) {
  const user = await requireAppUser();
  if (!canWriteDocumentos(user.perfil)) redirect("/");
  await deleteDocument(id);
  revalidatePath("/documentos");
}
