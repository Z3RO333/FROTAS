"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERFIS_USUARIO, canManageUsers, requireAppUser } from "@/lib/rbac";
import { createUsuario, getUsuarioById, setSenhaUsuario, updateUsuario } from "@/lib/repos/usuarios";
import { publicActionError } from "@/lib/public-error";

const UsuarioSchema = z.object({
  nome: z.string().trim().optional(),
  email: z.string().trim().email("E-mail inválido"),
  matricula: z.string().trim().optional(),
  perfil: z.enum(PERFIS_USUARIO),
  ativo: z.boolean(),
  tipo_conta: z.enum(["INTERNO", "TERCEIRO"]),
});

const UpdateUsuarioSchema = UsuarioSchema.extend({
  id: z.string().trim().min(1),
});

const SenhaSchema = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.");

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
    tipo_conta: String(formData.get("tipo_conta") ?? "INTERNO"),
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

    let senha: string | null = null;
    if (input.tipo_conta === "TERCEIRO") {
      const parsedSenha = SenhaSchema.safeParse(String(formData.get("senha") ?? ""));
      if (!parsedSenha.success) {
        redirectBack("erro", parsedSenha.error.issues[0]?.message ?? "Senha inválida.");
      }
      senha = parsedSenha.data;
    }

    const usuario = await createUsuario(input, actor.email);
    if (senha) await setSenhaUsuario(usuario.id, senha);

    revalidatePath("/administracao/usuarios");
    redirectBack("sucesso", "Usuário criado com perfil manual.");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirectBack("erro", publicActionError(error, "Não foi possível criar o usuário."));
  }
}

export async function redefinirSenhaTerceiroAction(formData: FormData) {
  const actor = await requireAppUser();
  if (!canManageUsers(actor.perfil)) redirect("/");

  const id = String(formData.get("id") ?? "");

  try {
    const target = await getUsuarioById(id);
    if (!target) redirectBack("erro", "Usuário não encontrado.");
    if (target.tipo_conta !== "TERCEIRO") {
      redirectBack("erro", "Redefinição de senha só se aplica a contas de motorista terceiro.");
    }

    const senha = SenhaSchema.parse(String(formData.get("senha") ?? ""));
    await setSenhaUsuario(id, senha);
    revalidatePath("/administracao/usuarios");
    redirectBack("sucesso", `Senha redefinida para ${target.nome ?? target.email}.`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirectBack("erro", publicActionError(error, "Não foi possível redefinir a senha."));
  }
}

export async function updateUsuarioAction(formData: FormData) {
  const actor = await requireAppUser();
  if (!canManageUsers(actor.perfil)) redirect("/");

  try {
    const input = UpdateUsuarioSchema.parse(readUsuarioForm(formData));
    const target = await getUsuarioById(input.id);
    if (!target) redirectBack("erro", "Usuário não encontrado.");
    if (target.perfil === "DEV" && actor.perfil !== "DEV") {
      redirectBack("erro", "Somente DEV pode alterar usuários DEV.");
    }
    ensureCanAssignPerfil(actor.perfil, input.perfil);

    if (target.email === actor.email && !input.ativo) {
      redirectBack("erro", "Você não pode desativar seu próprio usuário.");
    }

    await updateUsuario(
      input.id,
      {
        nome: input.nome,
        email: input.email,
        matricula: input.matricula,
        perfil: input.perfil,
        ativo: input.ativo,
        tipo_conta: input.tipo_conta,
      },
      actor.email
    );
    revalidatePath("/administracao/usuarios");
    redirectBack("sucesso", "Usuário atualizado.");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirectBack("erro", publicActionError(error, "Não foi possível atualizar o usuário."));
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
