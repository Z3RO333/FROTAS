"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { listPortariaToday, registrarMovimentacaoFrota } from "@/lib/repos/checklists";
import { requirePortariaUser } from "@/lib/rbac";

const MovimentoSchema = z.object({
  frota_id: z.coerce.number().int().positive(),
  checklist_id: z.coerce.number().int().positive(),
  tipo_movimentacao: z.enum(["SAIDA", "ENTRADA"]),
  observacao: z.string().trim().optional().nullable(),
});

function formObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    obj[key] = value === "" ? null : value;
  }
  return obj;
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function registrarMovimentacaoPortariaAction(formData: FormData) {
  try {
    const user = await requirePortariaUser();
    const parsed = MovimentoSchema.parse(formObject(formData));
    const rows = await listPortariaToday();
    const row = rows.find(
      (item) => item.frota_id === parsed.frota_id && item.checklist_id === parsed.checklist_id
    );

    if (!row || !row.checklist_id || !row.motorista_id) {
      redirect(`/portaria?erro=${encodeURIComponent("Checklist válido de hoje não encontrado para esta frota.")}`);
    }

    if (parsed.tipo_movimentacao === "SAIDA" && row.status_portaria !== "LIBERADA_SAIDA") {
      redirect(`/portaria?erro=${encodeURIComponent("Saída bloqueada: a frota não está liberada pela regra da portaria.")}`);
    }

    if (parsed.tipo_movimentacao === "ENTRADA" && row.status_portaria !== "SAIDA_REGISTRADA") {
      redirect(`/portaria?erro=${encodeURIComponent("Entrada permitida somente depois de uma saída registrada.")}`);
    }

    await registrarMovimentacaoFrota({
      frota_id: parsed.frota_id,
      checklist_id: parsed.checklist_id,
      motorista_id: row.motorista_id,
      tipo_movimentacao: parsed.tipo_movimentacao,
      usuario_portaria_id: user.email,
      observacao: parsed.observacao,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const msg = error instanceof z.ZodError
      ? error.issues[0]?.message ?? "Dados inválidos."
      : error instanceof Error
        ? error.message
        : "Não foi possível registrar a movimentação.";
    redirect(`/portaria?erro=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/portaria");
}
