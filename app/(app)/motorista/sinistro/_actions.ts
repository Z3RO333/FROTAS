"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getFrota } from "@/lib/repos/frotas";
import { createSinistro } from "@/lib/repos/sinistros";
import { removeSinistroImages, uploadSinistroImage } from "@/lib/repos/sinistro-images";
import { requireAppUser } from "@/lib/rbac";
import { fileFromForm } from "@/lib/upload-validation";
import type { SinistroMotoristaActionState } from "./types";

const BoolStringSchema = z.enum(["sim", "nao"]);
const TipoSinistroSchema = z.enum(["veiculo", "casa"]);

function requiredText(formData: FormData, key: string, message: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value.trim();
}

function optionalText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalNumber(formData: FormData, key: string): number | null {
  const value = optionalText(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function generateTicketNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SIN-${date}-${suffix}`;
}

export async function enviarSinistroMotoristaAction(
  _prevState: SinistroMotoristaActionState,
  formData: FormData
): Promise<SinistroMotoristaActionState> {
  const user = await requireAppUser();
  const uploadedPaths: string[] = [];

  try {
    const tipoSinistro = TipoSinistroSchema.parse(formData.get("tipo_sinistro"));
    const frotaId = z.coerce.number().int().positive("Selecione uma frota.").parse(formData.get("frota_id"));
    const descricao = requiredText(formData, "descricao", "Descreva o que aconteceu no sinistro.");
    const endereco = requiredText(formData, "endereco", "Informe o endereco do sinistro.");
    const setor = optionalText(formData, "setor");
    const houveFeridos = BoolStringSchema.parse(formData.get("houve_feridos")) === "sim";
    const samuBombeirosPresente = houveFeridos
      ? BoolStringSchema.parse(formData.get("samu_bombeiros_presente")) === "sim"
      : null;
    const terceirosQuantidade = z.coerce.number().int().min(0).max(10).parse(formData.get("terceiros_quantidade") ?? "0");

    const terceiros = Array.from({ length: terceirosQuantidade }, (_, index) => {
      const prefix = `terceiro_${index}`;
      return {
        nome: requiredText(formData, `${prefix}_nome`, "Preencha o nome de todos os terceiros."),
        telefone: requiredText(formData, `${prefix}_telefone`, "Preencha o telefone de todos os terceiros.").replace(/\D/g, ""),
        cpf: requiredText(formData, `${prefix}_cpf`, "Preencha o CPF de todos os terceiros.").replace(/\D/g, ""),
      };
    });

    const frota = await getFrota(frotaId);
    if (!frota || !frota.ativo || frota.vendido) throw new Error("Frota indisponivel para reporte de sinistro.");

    const ticketNumber = generateTicketNumber();
    const mediaFiles = formData
      .getAll("media")
      .map(fileFromForm)
      .filter((file): file is File => Boolean(file));

    for (const file of mediaFiles.slice(0, 8)) {
      const path = await uploadSinistroImage(file, { ticketNumber });
      uploadedPaths.push(path);
    }

    await createSinistro({
      ticket_number: ticketNumber,
      tipo_sinistro: tipoSinistro,
      frota_id: frotaId,
      numero_frota: frota.frota_geral ?? null,
      placa: frota.placa ?? null,
      motorista_id: user.email,
      motorista_nome: user.name,
      endereco,
      latitude: optionalNumber(formData, "latitude"),
      longitude: optionalNumber(formData, "longitude"),
      setor,
      descricao,
      houve_feridos: houveFeridos,
      samu_bombeiros_presente: samuBombeirosPresente,
      terceiros,
      media_paths: uploadedPaths,
    });

    revalidatePath("/motorista");
    revalidatePath("/motorista/sinistros");
    return { ok: true, redirectTo: `/motorista/sinistros?ticket=${encodeURIComponent(ticketNumber)}` };
  } catch (error) {
    await removeSinistroImages(uploadedPaths).catch((cleanupError) => {
      console.warn("[sinistros] falha ao limpar imagens apos erro", cleanupError);
    });
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Dados invalidos no sinistro." };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Nao foi possivel enviar o sinistro." };
  }
}
