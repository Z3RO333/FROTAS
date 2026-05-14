"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser, canAccessOperacao } from "@/lib/rbac";
import { criarDemanda, atualizarStatusDemanda } from "@/lib/repos/manutencao/operacao";
import type { StatusDemanda } from "@/lib/repos/manutencao/types";

const DemandaSchema = z.object({
  descricao: z.string().min(3),
  tipo_movimentacao: z.enum(["retirada", "levar_frota"]),
  prioridade: z.enum(["baixa", "normal", "alta", "urgente"]),
  destino: z.string().optional(),
  id_veiculo: z.string().optional(),
});

export async function criarDemandaAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canAccessOperacao(user.perfil)) redirect("/");
  const input = DemandaSchema.parse(Object.fromEntries(formData));
  await criarDemanda({ ...input, criado_por_email: user.email, criado_por_nome: user.name });
  revalidatePath("/operacao");
}

export async function atualizarStatusAction(id: string, status: string) {
  const user = await requireAppUser();
  if (!canAccessOperacao(user.perfil)) redirect("/");
  await atualizarStatusDemanda(id, status as StatusDemanda);
  revalidatePath("/operacao");
}
