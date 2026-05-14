"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { registrarPreventiva } from "@/lib/repos/manutencao/equipamentos";

const PreventivaSchema = z.object({
  equipamento_id: z.string().uuid(),
  tipo_preventiva: z.enum(["300h", "1500h"]),
  data_servico: z.string().min(1),
  horimetro_servico: z.coerce.number().positive(),
  observacoes: z.string().optional(),
});

export async function registrarPreventivaAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");
  const input = PreventivaSchema.parse(Object.fromEntries(formData));
  await registrarPreventiva({
    ...input,
    registrado_por_email: user.email,
    registrado_por_nome: user.name,
  });
  revalidatePath("/equipamentos");
}
