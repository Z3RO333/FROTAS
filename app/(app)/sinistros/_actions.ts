"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/rbac";
import { updateSocorroStatus, type SocorroStatus } from "@/lib/repos/sinistros";

const StatusSchema = z.enum(["ABERTO", "EM_ATENDIMENTO", "GUINCHO_ACIONADO", "RESOLVIDO", "CANCELADO"]);

export async function atualizarStatusSocorroAction(
  _prevState: { ok: boolean; error: string | null },
  formData: FormData
): Promise<{ ok: boolean; error: string | null }> {
  const admin = await requireAdminUser();

  try {
    const sinistroId = z.coerce.number().int().positive().parse(formData.get("sinistro_id"));
    const novoStatus = StatusSchema.parse(formData.get("novo_status")) as SocorroStatus;

    await updateSocorroStatus(sinistroId, novoStatus, admin.email);
    revalidatePath("/sinistros");
    return { ok: true, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Dados invalidos." };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Nao foi possivel atualizar o status." };
  }
}
