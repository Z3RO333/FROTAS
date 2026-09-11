"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireGestorUser } from "@/lib/rbac";
import { renomearModeloFrota } from "@/lib/repos/modelos-frota";
import { publicActionError } from "@/lib/public-error";

export type RenomearModeloActionState = { ok: true; mensagem: string } | { ok: false; error: string };

function isRedirectError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}

export async function renomearModeloAction(_prev: RenomearModeloActionState, formData: FormData): Promise<RenomearModeloActionState> {
  try {
    const user = await requireGestorUser();
    const nomeAtual = String(formData.get("nome_atual") ?? "");
    const nomeNovo = String(formData.get("nome_novo") ?? "");
    const total = await renomearModeloFrota(nomeAtual, nomeNovo, user.email);
    updateTag("frotas:filters");
    updateTag("frotas:dashboard");
    revalidatePath("/administracao/unificacoes/modelos");
    revalidatePath("/frotas");
    revalidatePath("/frotas/vendidos");
    revalidatePath("/frotas/ocultas");
    return { ok: true, mensagem: `${total} frota(s) atualizada(s) para "${nomeNovo.trim()}".` };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { ok: false, error: publicActionError(error, "Erro ao unificar modelo de frota.") };
  }
}
