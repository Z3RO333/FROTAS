"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERFIS_USUARIO, canManageUsers, requireAppUser } from "@/lib/rbac";
import { createUsuario, getUsuarioById, updateUsuario } from "@/lib/repos/usuarios";

const UsuarioSchema = z.object({
  nome: z.string().trim().optional(),
  email: z.string().trim().email("E-mail invalido"),
  matricula: z.string().trim().optional(),
  perfil: z.enum(PERFIS_USUARIO),
  ativo: z.boolean(),
});

const UpdateUsuarioSchema = UsuarioSchema.extend({
  id: z.string().trim().min(1),
});

function readUsuarioForm(formData: FormData) {
  // O form envia "ativo" duas vezes (hidden=false + checkbox=true quando marcado).
  // Usamos getAll para detectar se o checkbox foi marcado, independente da ordem.
  const ativoValues = formData.getAll("ativo").map((v) => String(v));
  return {
    id: String(formData.get("id") ?? ""),
    nome: String(formData.get("nome") ?? ""),
    email: String(formData.get("email") ?? ""),
    matricula: String(formData.get("matricula") ?? ""),
    perfil: String(formData.get("perfil") ?? ""),
    ativo: ativoValues.includes("true"),
  };
}

function redirectBack(type: "sucesso" | "erro", message: string): never {
  redirect(`/administracao/usuarios?${type}=${encodeURIComponent(message)}`);
}

function ensureCanAssignPerfil(actorPerfil: string, targetPerfil: string): void {
  if (targetPerfil === "DEV" && actorPerfil !== "DEV") {
    redirectBack("erro", "Somente DEV pode atribuir perfil DEV.");
  }
}

export async function createUsuarioAction(formData: FormData) {
  const actor = await requireAppUser();
  if (!canManageUsers(actor.perfil)) redirect("/");

  try {
    const input = UsuarioSchema.parse(readUsuarioForm(formData));
    ensureCanAssignPerfil(actor.perfil, input.perfil);
    await createUsuario(input, actor.email);
    revalidatePath("/administracao/usuarios");
    redirectBack("sucesso", "Usuario criado com perfil manual.");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirectBack("erro", error instanceof Error ? error.message : "Nao foi possivel criar o usuario.");
  }
}

export async function updateUsuarioAction(formData: FormData) {
  const actor = await requireAppUser();
  if (!canManageUsers(actor.perfil)) redirect("/");

  try {
    const input = UpdateUsuarioSchema.parse(readUsuarioForm(formData));
    const target = await getUsuarioById(input.id);
    if (!target) redirectBack("erro", "Usuario nao encontrado.");
    if (target.perfil === "DEV" && actor.perfil !== "DEV") {
      redirectBack("erro", "Somente DEV pode alterar usuarios DEV.");
    }
    ensureCanAssignPerfil(actor.perfil, input.perfil);

    if (target.email === actor.email && !input.ativo) {
      redirectBack("erro", "Voce nao pode desativar seu proprio usuario.");
    }

    await updateUsuario(
      input.id,
      {
        nome: input.nome,
        email: input.email,
        matricula: input.matricula,
        perfil: input.perfil,
        ativo: input.ativo,
      },
      actor.email
    );
    revalidatePath("/administracao/usuarios");
    redirectBack("sucesso", "Usuario atualizado.");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirectBack("erro", error instanceof Error ? error.message : "Nao foi possivel atualizar o usuario.");
  }
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}
