"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { registrarServico } from "@/lib/repos/manutencao/servicos";
const ServicoSchema = z.object({
  id_veiculo: z.string().min(1),
  tipo_servico: z.enum([
    "troca_pneu", "lavagem", "alinhamento", "balanceamento",
    "tacografo", "portas_rool_up", "embreagem", "motor",
    "km_diario", "ar-condicionado", "suspensao", "bateria",
  ]),
  quilometragem: z.coerce.number().int().positive().optional(),
  observacoes: z.string().optional(),
});

export async function registrarServicoAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");
  const input = ServicoSchema.parse(Object.fromEntries(formData));
  await registrarServico({
    ...input,
    registrado_por_email: user.email,
    registrado_por_nome: user.name,
  });
  revalidatePath("/manutencao");
}
