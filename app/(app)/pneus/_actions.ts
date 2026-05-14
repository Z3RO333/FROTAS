"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { registrarTrocaPneu } from "@/lib/repos/manutencao/pneus";

const TrocaSchema = z.object({
  id_veiculo: z.string().min(1),
  quilometragem: z.coerce.number().int().positive(),
  observacoes: z.string().optional(),
  posicoes: z.string().transform((val) =>
    JSON.parse(val) as Array<{ posicao: string; numero_fogo?: string }>
  ),
});

export async function registrarTrocaAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");
  const input = TrocaSchema.parse(Object.fromEntries(formData));
  await registrarTrocaPneu({
    ...input,
    registrado_por_email: user.email,
    registrado_por_nome: user.name,
  });
  revalidatePath("/pneus");
}
