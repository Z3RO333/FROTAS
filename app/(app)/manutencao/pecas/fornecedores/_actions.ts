"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireManutencaoUser } from "@/lib/rbac";
import { atualizarFornecedorPecas, criarFornecedorPecas } from "@/lib/repos/fornecedores-pecas";

const NovoFornecedorSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do fornecedor."),
  email: z.string().trim().email("Informe um e-mail válido."),
});

const AtualizarFornecedorSchema = NovoFornecedorSchema.extend({
  id: z.coerce.number().int().positive(),
  ativo: z.coerce.boolean(),
});

function redirectWith(params: Record<string, string>): never {
  const search = new URLSearchParams(params);
  redirect(`/manutencao/pecas/fornecedores?${search.toString()}`);
}

export async function criarFornecedorPecasAction(formData: FormData): Promise<void> {
  await requireManutencaoUser();
  const parsed = NovoFornecedorSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    redirectWith({ erro: parsed.error.issues[0]?.message ?? "Revise os dados do fornecedor." });
  }
  await criarFornecedorPecas(parsed.data);
  revalidatePath("/manutencao/pecas/fornecedores");
  redirectWith({ sucesso: "Fornecedor salvo." });
}

export async function atualizarFornecedorPecasAction(formData: FormData): Promise<void> {
  await requireManutencaoUser();
  const parsed = AtualizarFornecedorSchema.safeParse({
    id: formData.get("id"),
    nome: formData.get("nome"),
    email: formData.get("email"),
    ativo: formData.get("ativo") === "true",
  });
  if (!parsed.success) {
    redirectWith({ erro: parsed.error.issues[0]?.message ?? "Revise os dados do fornecedor." });
  }
  const { id, ...input } = parsed.data;
  await atualizarFornecedorPecas(id, input);
  revalidatePath("/manutencao/pecas/fornecedores");
  revalidatePath("/manutencao/pecas");
  redirectWith({ sucesso: "Fornecedor atualizado." });
}
