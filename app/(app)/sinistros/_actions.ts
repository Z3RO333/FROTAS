"use server";

import { revalidatePath } from "next/cache";
import { publicActionError } from "@/lib/public-error";
import { z } from "zod";
import { requireSinistrosUser } from "@/lib/rbac";
import { updateSocorroStatus, updateSinistroStatus, type SocorroStatus, type SinistroStatus } from "@/lib/repos/sinistros";

const StatusSchema = z.enum(["ABERTO", "EM_ATENDIMENTO", "GUINCHO_ACIONADO", "RESOLVIDO", "CANCELADO"]);
const SinistroStatusSchema = z.enum(["PENDENTE", "RESOLVIDO", "CANCELADO"]);

export async function atualizarStatusSocorroAction(
  _prevState: { ok: boolean; error: string | null },
  formData: FormData
): Promise<{ ok: boolean; error: string | null }> {
  const admin = await requireSinistrosUser();

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
    return { ok: false, error: publicActionError(error, "Nao foi possivel atualizar o status.") };
  }
}

export async function atualizarStatusSinistroAction(
  _prevState: { ok: boolean; error: string | null },
  formData: FormData
): Promise<{ ok: boolean; error: string | null }> {
  const admin = await requireSinistrosUser();

  try {
    const sinistroId = z.coerce.number().int().positive().parse(formData.get("sinistro_id"));
    const novoStatus = SinistroStatusSchema.parse(formData.get("novo_status")) as SinistroStatus;

    await updateSinistroStatus(sinistroId, novoStatus, admin.email);
    revalidatePath("/sinistros");
    return { ok: true, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Dados invalidos." };
    }
    return { ok: false, error: publicActionError(error, "Nao foi possivel atualizar o status.") };
  }
}
