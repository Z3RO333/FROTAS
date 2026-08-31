import { randomUUID } from "node:crypto";
import { sanitizeImageForStorage } from "@/lib/upload-validation";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export const ATIVIDADES_MEDIA_BUCKET = "atividades-media";

export async function uploadAtividadeImage(file: File, args: { atividadeId: number }): Promise<string> {
  const sanitized = await sanitizeImageForStorage(file, "Foto de conclusão");
  const path = `${args.atividadeId}/conclusao-${Date.now()}-${randomUUID()}.${sanitized.extension}`;

  const { error } = await supabaseManutencao.storage.from(ATIVIDADES_MEDIA_BUCKET).upload(path, sanitized.buffer, {
    cacheControl: "3600",
    contentType: sanitized.contentType,
    upsert: false,
  });

  if (error) throw new Error(`uploadAtividadeImage: ${error.message}`);
  return path;
}

export async function createSignedAtividadeImageUrl(path: string, expiresIn = 60 * 30): Promise<string> {
  const { data, error } = await supabaseManutencao.storage
    .from(ATIVIDADES_MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`createSignedAtividadeImageUrl: ${error?.message ?? "URL assinada indisponível"}`);
  }

  return data.signedUrl;
}
