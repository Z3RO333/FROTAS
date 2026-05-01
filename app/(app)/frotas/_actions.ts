"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createFrota, softDeleteFrota, updateFrota } from "@/lib/repos/frotas";

const StatusEnum = z.enum(["disponivel", "manutencao", "atencao", "critico", "vendido"]);

const FrotaSchema = z.object({
  frota_geral: z.string().trim().optional().nullable(),
  placa: z.string().trim().min(1).max(20).optional().nullable(),
  modelo: z.string().trim().min(1).max(100),
  chassi: z.string().trim().min(5).max(40),
  renavam: z.string().trim().optional().nullable(),
  ano_fabricacao: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  localizacao: z.string().trim().optional().nullable(),
  km_atual: z.coerce.number().int().min(0).optional().nullable(),
  status: StatusEnum.optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
});

async function requireUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Nao autenticado");
  return session.user.email;
}

function formObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    obj[key] = value === "" ? null : value;
  }
  return obj;
}

export async function criarFrotaAction(formData: FormData) {
  const email = await requireUser();
  const parsed = FrotaSchema.parse(formObject(formData));
  const id = await createFrota(parsed, email);
  revalidatePath("/frotas");
  redirect(`/frotas/${id}`);
}

export async function editarFrotaAction(id: number, formData: FormData) {
  const email = await requireUser();
  const parsed = FrotaSchema.partial().parse(formObject(formData));
  await updateFrota(id, parsed, email);
  revalidatePath(`/frotas/${id}`);
  revalidatePath("/frotas");
  redirect(`/frotas/${id}`);
}

export async function excluirFrotaAction(id: number) {
  const email = await requireUser();
  await softDeleteFrota(id, email);
  revalidatePath("/frotas");
  redirect("/frotas");
}
