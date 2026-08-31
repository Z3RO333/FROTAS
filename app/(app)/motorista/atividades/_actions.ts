"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMotoristaUser } from "@/lib/rbac";
import { concluirAtividade, listAtividadesPendentesPorMotorista } from "@/lib/repos/atividades-manutencao";
import { uploadAtividadeImage } from "@/lib/repos/atividades-media";
import { existsChecklistHojeParaFrota } from "@/lib/repos/checklists";
import { requiresChecklistDoDia, requiresFotoNaConclusao } from "@/lib/atividades/rules";
import { fileFromForm } from "@/lib/upload-validation";
import { publicActionError } from "@/lib/public-error";

export type ConcluirAtividadeActionState = {
  error: string | null;
  attempt: number;
};

export async function concluirAtividadeAction(
  previousState: ConcluirAtividadeActionState,
  formData: FormData
): Promise<ConcluirAtividadeActionState> {
  const user = await requireMotoristaUser();

  try {
    const atividadeId = z.coerce.number().int().positive().parse(formData.get("atividade_id"));
    const pendentes = await listAtividadesPendentesPorMotorista(user.email);
    const atividade = pendentes.find((a) => a.id === atividadeId);
    if (!atividade) throw new Error("Atividade não encontrada ou já concluída.");

    if (requiresChecklistDoDia(atividade.tipo)) {
      const temChecklist = await existsChecklistHojeParaFrota(user.email, atividade.frota_id);
      if (!temChecklist) {
        throw new Error(`Faça o checklist da frota ${atividade.frota_codigo} antes de concluir esta atividade.`);
      }
    }

    const foto = fileFromForm(formData.get("foto"));
    if (requiresFotoNaConclusao(atividade.tipo) && !foto) {
      throw new Error("Anexe uma foto de chegada para concluir esta atividade.");
    }

    const fotoPath = foto ? await uploadAtividadeImage(foto, { atividadeId }) : null;
    await concluirAtividade(atividadeId, { fotoPath });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: "Atividade inválida.", attempt: previousState.attempt + 1 };
    }
    return { error: publicActionError(error, "Não foi possível concluir a atividade."), attempt: previousState.attempt + 1 };
  }

  revalidatePath("/motorista/atividades");
  revalidatePath("/motorista");
  return { error: null, attempt: previousState.attempt + 1 };
}
