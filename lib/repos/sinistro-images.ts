import { randomUUID } from "node:crypto";
import { imageExtensionFromMime, safeContentTypeFromExtension, validateImageFile } from "@/lib/upload-validation";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export const SINISTRO_MEDIA_BUCKET = "sinistro-media";

export async function uploadSinistroImage(file: File, args: { ticketNumber: string }): Promise<string> {
  await validateImageFile(file, "Foto do sinistro");

  const extension = imageExtensionFromMime(file.type);
  const dateSegment = new Date().toISOString().slice(0, 10);
  const path = [
    sanitizeSegment(args.ticketNumber),
    dateSegment,
    `sinistro-${Date.now()}-${randomUUID()}.${extension}`,
  ].join("/");

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseManutencao.storage.from(SINISTRO_MEDIA_BUCKET).upload(path, buffer, {
    cacheControl: "3600",
    contentType: safeContentTypeFromExtension(extension),
    upsert: false,
  });

  if (error) throw new Error(`uploadSinistroImage: ${error.message}`);
  return path;
}

export async function removeSinistroImages(paths: Array<string | null | undefined>): Promise<void> {
  const cleanPaths = paths.map((path) => path?.trim()).filter((path): path is string => Boolean(path));
  if (cleanPaths.length === 0) return;

  const { error } = await supabaseManutencao.storage.from(SINISTRO_MEDIA_BUCKET).remove(cleanPaths);
  if (error) throw new Error(`removeSinistroImages: ${error.message}`);
}

export async function createSignedSinistroImageUrl(path: string, expiresIn = 60 * 30): Promise<string> {
  const { data, error } = await supabaseManutencao.storage
    .from(SINISTRO_MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`createSignedSinistroImageUrl: ${error?.message ?? "URL assinada indisponivel"}`);
  }

  return data.signedUrl;
}

function sanitizeSegment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}
