"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMotoristaUser } from "@/lib/rbac";
import {
  concluirAtividade,
  iniciarAtividade,
  listAtividadesAbertas,
  listAtividadesPendentesPorMotorista,
  pegarAtividade,
} from "@/lib/repos/atividades-manutencao";
import { uploadAtividadeImage } from "@/lib/repos/atividades-media";
import { existsChecklistHojeParaFrota } from "@/lib/repos/checklists";
import { requiresChecklistDoDia, requiresFotoNaConclusao } from "@/lib/atividades/rules";
import { fileFromForm, validateAggregateFileSize } from "@/lib/upload-validation";
import { publicActionError } from "@/lib/public-error";

export const MAX_FOTOS = 5;

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

    if (atividade.status !== "EM_ANDAMENTO") {
      throw new Error("Inicie a atividade antes de concluir.");
    }

    const fotos = formData
      .getAll("fotos")
      .map(fileFromForm)
      .filter((f): f is File => Boolean(f));

    if (requiresFotoNaConclusao(atividade.tipo) && fotos.length === 0) {
      throw new Error("Anexe ao menos uma foto de chegada para concluir esta atividade.");
    }
    if (fotos.length > MAX_FOTOS) {
      throw new Error(`Envie no máximo ${MAX_FOTOS} fotos por atividade.`);
    }
    validateAggregateFileSize(fotos, 20 * 1024 * 1024, "Fotos da atividade");

    const fotoPaths: string[] = [];
    for (const foto of fotos) {
      fotoPaths.push(await uploadAtividadeImage(foto, { atividadeId }));
    }

    const concluida = await concluirAtividade(atividadeId, {
      fotoPaths,
      concluidoPorId: user.email,
      concluidoPorNome: user.name,
    });
    if (!concluida) throw new Error("Esta atividade já foi concluída por outro motorista.");
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

export async function iniciarAtividadeAction(
  previousState: ConcluirAtividadeActionState,
  formData: FormData
): Promise<ConcluirAtividadeActionState> {
  const user = await requireMotoristaUser();

  try {
    const atividadeId = z.coerce.number().int().positive().parse(formData.get("atividade_id"));

    const minhas = await listAtividadesPendentesPorMotorista(user.email);
    const atividade = minhas.find((a) => a.id === atividadeId);
    if (!atividade) throw new Error("Atividade não encontrada.");
    if (atividade.status === "EM_ANDAMENTO") throw new Error("Esta atividade já está em andamento.");

    const iniciada = await iniciarAtividade(atividadeId, user.email);
    if (!iniciada) throw new Error("Outro motorista já iniciou esta atividade.");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: "Atividade inválida.", attempt: previousState.attempt + 1 };
    }
    return {
      error: publicActionError(error, "Não foi possível iniciar a atividade."),
      attempt: previousState.attempt + 1,
    };
  }

  revalidatePath("/motorista/atividades");
  revalidatePath("/motorista");
  return { error: null, attempt: previousState.attempt + 1 };
}

export async function pegarAtividadeAction(
  previousState: ConcluirAtividadeActionState,
  formData: FormData
): Promise<ConcluirAtividadeActionState> {
  const user = await requireMotoristaUser();

  try {
    const atividadeId = z.coerce.number().int().positive().parse(formData.get("atividade_id"));

    // Confere na lista de abertas em vez de confiar no id enviado: garante que
    // a atividade existe, está pendente e continua sem dono.
    const abertas = await listAtividadesAbertas();
    if (!abertas.some((a) => a.id === atividadeId)) {
      throw new Error("Esta atividade não está mais disponível.");
    }

    const pegou = await pegarAtividade(atividadeId, user.email, user.name);
    if (!pegou) throw new Error("Outro motorista pegou esta atividade primeiro.");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: "Atividade inválida.", attempt: previousState.attempt + 1 };
    }
    return {
      error: publicActionError(error, "Não foi possível pegar a atividade."),
      attempt: previousState.attempt + 1,
    };
  }

  revalidatePath("/motorista/atividades");
  revalidatePath("/motorista");
  return { error: null, attempt: previousState.attempt + 1 };
}
