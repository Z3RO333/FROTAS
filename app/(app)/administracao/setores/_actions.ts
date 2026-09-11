"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireGestorUser } from "@/lib/rbac";
import { renomearSetor } from "@/lib/repos/setores";
import { publicActionError } from "@/lib/public-error";

export type RenomearSetorActionState =
  | { ok: true; mensagem: string }
  | { ok: false; error: string };

export const RENOMEAR_SETOR_INITIAL_STATE: RenomearSetorActionState = { ok: true, mensagem: "" };

// redirect() dentro de requireGestorUser() lança um erro especial (digest
// "NEXT_REDIRECT") que o Next.js espera propagar sem interferência — sem
// este guard, o catch abaixo engolia o redirect (sessão vencida/perfil sem
// permissão) e devolvia um estado normal, deixando o Next.js numa
// inconsistência que estourava a error boundary da página inteira.
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function renomearSetorAction(
  _prev: RenomearSetorActionState,
  formData: FormData
): Promise<RenomearSetorActionState> {
  try {
    const user = await requireGestorUser();
    const nomeAtual = String(formData.get("nome_atual") ?? "");
    const nomeNovo = String(formData.get("nome_novo") ?? "");

    const resultado = await renomearSetor(nomeAtual, nomeNovo, user.email);

    updateTag("frotas:filters");
    revalidatePath("/administracao/setores");
    revalidatePath("/frotas");
    revalidatePath("/frotas/vendidos");
    revalidatePath("/frotas/ocultas");

    const destino = nomeNovo.trim() || "(sem setor)";
    const agendasMsg = resultado.agendasAtualizadas > 0 ? ` e ${resultado.agendasAtualizadas} agenda(s) de e-mail` : "";
    return {
      ok: true,
      mensagem: `${resultado.frotasAtualizadas} frota(s) atualizada(s) para "${destino}"${agendasMsg}.`,
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { ok: false, error: publicActionError(error, "Erro ao renomear setor.") };
  }
}
