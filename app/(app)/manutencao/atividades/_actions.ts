"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireManutencaoUser } from "@/lib/rbac";
import { getFrota } from "@/lib/repos/frotas";
import { getUsuarioById } from "@/lib/repos/usuarios";
import { criarAtividade } from "@/lib/repos/atividades-manutencao";
import { ATIVIDADE_TIPOS } from "@/lib/atividades/rules";
import { publicActionError } from "@/lib/public-error";

const CriarAtividadeSchema = z.object({
  frotaId: z.coerce.number().int().positive("Selecione uma frota."),
  tipo: z.enum(ATIVIDADE_TIPOS, { message: "Selecione o tipo de atividade." }),
  local: z.string().trim().min(1, "Informe o local."),
  observacao: z.string().trim().optional(),
  motoristaId: z.string().trim().min(1, "Selecione o motorista."),
});

export type AtividadeFormValues = {
  frotaId: number | null;
  tipo: string;
  local: string;
  observacao: string;
  motoristaId: string;
};

export type AtividadeActionState = {
  error: string | null;
  values: AtividadeFormValues | null;
  attempt: number;
};

function rawValues(formData: FormData): AtividadeFormValues {
  const frota = Number(formData.get("frota_id"));
  return {
    frotaId: Number.isInteger(frota) && frota > 0 ? frota : null,
    tipo: String(formData.get("tipo") ?? ""),
    local: String(formData.get("local") ?? ""),
    observacao: String(formData.get("observacao") ?? ""),
    motoristaId: String(formData.get("motorista_id") ?? ""),
  };
}

export async function criarAtividadeAction(
  previousState: AtividadeActionState,
  formData: FormData
): Promise<AtividadeActionState> {
  const user = await requireManutencaoUser();
  const values = rawValues(formData);

  try {
    const parsed = CriarAtividadeSchema.parse({
      frotaId: formData.get("frota_id"),
      tipo: formData.get("tipo"),
      local: formData.get("local"),
      observacao: formData.get("observacao") || undefined,
      motoristaId: formData.get("motorista_id"),
    });

    const frota = await getFrota(parsed.frotaId);
    if (!frota || !frota.ativo || frota.vendido) throw new Error("Frota não encontrada ou inativa.");

    const motorista = await getUsuarioById(parsed.motoristaId);
    if (!motorista || motorista.perfil !== "MOTORISTA_INTERNO" || !motorista.ativo) {
      throw new Error("Selecione um motorista interno ativo.");
    }

    await criarAtividade({
      frotaId: frota.id,
      frotaCodigo: frota.frota_geral ?? String(frota.id),
      tipo: parsed.tipo,
      local: parsed.local,
      observacao: parsed.observacao ?? null,
      motoristaId: motorista.id,
      motoristaNome: motorista.nome ?? motorista.email,
      criadoPorEmail: user.email,
      criadoPorNome: user.name,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: error.issues[0]?.message ?? "Revise os dados da atividade.",
        values,
        attempt: previousState.attempt + 1,
      };
    }
    return {
      error: publicActionError(error, "Não foi possível criar a atividade."),
      values,
      attempt: previousState.attempt + 1,
    };
  }

  revalidatePath("/manutencao/atividades");
  return { error: null, values: null, attempt: previousState.attempt + 1 };
}
