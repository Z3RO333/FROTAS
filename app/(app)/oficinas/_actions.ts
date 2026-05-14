"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { criarOficina } from "@/lib/repos/manutencao/oficinas";

const OficinaSchema = z.object({
  nome: z.string().min(2),
  categoria: z.string().default("oficina"),
  localizacao: z.string().min(2),
  tipos_servico: z.string().transform((val) =>
    val.split(",").map((s) => s.trim()).filter(Boolean)
  ),
});

export async function criarOficinaAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");
  const input = OficinaSchema.parse(Object.fromEntries(formData));
  await criarOficina(input);
  revalidatePath("/oficinas");
}
