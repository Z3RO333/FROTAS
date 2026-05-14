"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/rbac";
import {
  approveKmEntry,
  correctKmEntry,
  getKmEntry,
} from "@/lib/repos/historico-km";
import { aplicarResumoChecklist, getFrota } from "@/lib/repos/frotas";

const IdSchema = z.coerce.number().int().positive();
const KmSchema = z.coerce.number().int().min(0);

function revalidate() {
  revalidatePath("/checklists");
  revalidatePath("/checklists/validacao-km");
  revalidatePath("/frotas");
}

export async function aprovarKmAction(formData: FormData) {
  const user = await requireAdminUser();
  const id = IdSchema.parse(formData.get("id"));
  const observacao = (formData.get("observacao") as string | null)?.trim() || null;

  const entry = await getKmEntry(id);
  if (!entry) throw new Error("Registro de KM nao encontrado.");
  if (entry.validado) return;

  await approveKmEntry(id, user.email, observacao);

  // Garante que km_atual da frota reflete o KM aprovado e marca km_validado.
  await aplicarResumoChecklist(
    entry.frota_id,
    {
      km_atual: entry.km_novo,
      km_origem: entry.origem,
    },
    user.email
  );

  revalidate();
}

export async function corrigirKmAction(formData: FormData) {
  const user = await requireAdminUser();
  const id = IdSchema.parse(formData.get("id"));
  const kmCorrigido = KmSchema.parse(formData.get("km_corrigido"));
  const observacao = ((formData.get("observacao") as string | null) ?? "").trim();
  if (!observacao) throw new Error("Informe uma justificativa para a correcao do KM.");

  const entry = await getKmEntry(id);
  if (!entry) throw new Error("Registro de KM nao encontrado.");

  await correctKmEntry(id, kmCorrigido, user.email, observacao);

  // Atualiza km_atual da frota com o valor corrigido (apenas se este registro é o último).
  const frota = await getFrota(entry.frota_id);
  if (frota && frota.km_atual === entry.km_novo) {
    await aplicarResumoChecklist(
      entry.frota_id,
      {
        km_atual: kmCorrigido,
        km_origem: "AJUSTE_ADMIN",
      },
      user.email
    );
  }

  revalidate();
}
