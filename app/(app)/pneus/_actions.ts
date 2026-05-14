"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canAccessManutencao, requireAppUser } from "@/lib/rbac";
import { registrarTrocaPneu } from "@/lib/repos/manutencao/pneus";

const TrocaSchema = z.object({
  id_veiculo: z.string().min(1),
  quilometragem: z.coerce.number().int().positive(),
  observacoes: z.string().optional(),
  posicoes: z
    .string()
    .transform((val, ctx) => {
      try {
        return JSON.parse(val) as Array<{ posicao: string; numero_fogo?: string }>;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "posições deve ser JSON válido" });
        return z.NEVER;
      }
    })
    .pipe(
      z
        .array(
          z.object({
            posicao: z.string().min(1),
            numero_fogo: z.string().optional(),
          })
        )
        .min(1, "Selecione ao menos uma posição.")
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
