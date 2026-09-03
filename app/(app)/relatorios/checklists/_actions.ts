"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolverAlerta } from "@/lib/repos/alertas";
import { revisarAnalise } from "@/lib/repos/analises-ia";
import { requireAdminUser } from "@/lib/rbac";

export type RelatorioActionResult = {
  ok: boolean;
  message: string;
};

export async function resolverAlertaAction(formData: FormData) {
  const user = await requireAdminUser();
  try {
    const alertaId = z.coerce.number().int().positive().parse(formData.get("alerta_id"));
    const status = z.enum(["RESOLVIDO", "IGNORADO"]).parse(formData.get("status"));
    await resolverAlerta(alertaId, user.email, status);
    revalidatePath("/relatorios/checklists");

    return {
      ok: true,
      message: status === "RESOLVIDO" ? "Alerta marcado como resolvido." : "Alerta ignorado.",
    } satisfies RelatorioActionResult;
  } catch (error) {
    console.error("[relatorios/checklists] Falha ao atualizar alerta", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível atualizar o alerta.",
    } satisfies RelatorioActionResult;
  }
}

export async function revisarAnaliseAction(formData: FormData) {
  const user = await requireAdminUser();
  const analiseId = z.coerce.number().int().positive().parse(formData.get("analise_id"));
  const criticidade = z.enum(["OK", "ATENCAO", "CRITICO", "MANUTENCAO", "BLOQUEIO_SUGERIDO"]).parse(
    formData.get("criticidade")
  );
  await revisarAnalise(analiseId, user.email, criticidade);
  revalidatePath("/relatorios/checklists");
}
