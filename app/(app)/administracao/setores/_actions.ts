"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireGestorUser } from "@/lib/rbac";
import { renomearSetor } from "@/lib/repos/setores";
import { publicActionError } from "@/lib/public-error";

export type RenomearSetorActionState =
  | { ok: true; mensagem: string }
  | { ok: false; error: string };

export const RENOMEAR_SETOR_INITIAL_STATE: RenomearSetorActionState = { ok: true, mensagem: "" };

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
    return { ok: false, error: publicActionError(error, "Erro ao renomear setor.") };
  }
}
