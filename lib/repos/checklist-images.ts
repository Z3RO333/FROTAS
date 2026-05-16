import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { imageExtensionFromMime, validateImageFile } from "@/lib/upload-validation";

export const CHECKLIST_IMAGES_BUCKET = "checklist-images";

export type ChecklistImageSourceType = "hodometro" | "item" | "abastecimento";
export type ChecklistVisionStatus = "queued" | "processing" | "processed" | "failed";

export type ChecklistImageInspection = {
  id: string;
  checklist_id: number;
  checklist_item_codigo: string | null;
  source_type: ChecklistImageSourceType;
  storage_path: string;
  status: ChecklistVisionStatus;
  model_name: string | null;
  confidence: number | null;
  detections: unknown[];
  summary: string | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
};

export type ChecklistImageInspectionInput = {
  checklist_id: number;
  checklist_item_codigo?: string | null;
  source_type: ChecklistImageSourceType;
  storage_path: string;
};

export type ChecklistVisionResult = {
  model_name?: string | null;
  confidence?: number | null;
  detections?: unknown[];
  summary?: string | null;
};

export async function uploadChecklistImage(
  file: File,
  args: {
    frotaId: number;
    sourceType: ChecklistImageSourceType;
    itemCodigo?: string | null;
  }
): Promise<string> {
  await validateImageFile(file, labelFromSource(args.sourceType));

  const extension = imageExtensionFromMime(file.type);
  const dateSegment = new Date().toISOString().slice(0, 10);
  const itemSegment = args.itemCodigo ? `-${sanitizeSegment(args.itemCodigo)}` : "";
  const path = [
    String(args.frotaId),
    dateSegment,
    `${args.sourceType}${itemSegment}-${Date.now()}-${randomUUID()}.${extension}`,
  ].join("/");

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseManutencao.storage.from(CHECKLIST_IMAGES_BUCKET).upload(path, buffer, {
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
    upsert: false,
  });

  if (error) throw new Error(`uploadChecklistImage: ${error.message}`);
  return path;
}

export async function removeChecklistImages(paths: Array<string | null | undefined>): Promise<void> {
  const cleanPaths = paths.map((path) => path?.trim()).filter((path): path is string => Boolean(path));
  if (cleanPaths.length === 0) return;

  const { error } = await supabaseManutencao.storage.from(CHECKLIST_IMAGES_BUCKET).remove(cleanPaths);
  if (error) throw new Error(`removeChecklistImages: ${error.message}`);
}

export async function createChecklistImageInspections(inputs: ChecklistImageInspectionInput[]): Promise<void> {
  if (inputs.length === 0) return;

  const { error } = await supabaseManutencao.from("checklist_image_inspections").insert(
    inputs.map((input) => ({
      checklist_id: input.checklist_id,
      checklist_item_codigo: input.checklist_item_codigo ?? null,
      source_type: input.source_type,
      storage_path: input.storage_path,
      status: "queued",
    }))
  );

  if (error) throw new Error(`createChecklistImageInspections: ${error.message}`);
}

export async function countChecklistImageInspectionsByStatus(): Promise<Record<ChecklistVisionStatus, number>> {
  const base: Record<ChecklistVisionStatus, number> = {
    queued: 0,
    processing: 0,
    processed: 0,
    failed: 0,
  };

  const { data, error } = await supabaseManutencao
    .from("checklist_image_inspections")
    .select("status");

  if (error) {
    console.warn("[vision] contagem indisponivel", error);
    return base;
  }

  for (const row of data ?? []) {
    const status = String(row.status ?? "") as ChecklistVisionStatus;
    if (status in base) base[status] += 1;
  }

  return base;
}

export async function listQueuedChecklistImageInspections(limit = 10): Promise<ChecklistImageInspection[]> {
  const { data, error } = await supabaseManutencao
    .from("checklist_image_inspections")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`listQueuedChecklistImageInspections: ${error.message}`);
  return (data ?? []) as ChecklistImageInspection[];
}

export async function markChecklistImageInspectionProcessing(id: string): Promise<void> {
  const { error } = await supabaseManutencao
    .from("checklist_image_inspections")
    .update({ status: "processing", error_message: null })
    .eq("id", id);

  if (error) throw new Error(`markChecklistImageInspectionProcessing: ${error.message}`);
}

export async function markChecklistImageInspectionProcessed(
  id: string,
  result: ChecklistVisionResult
): Promise<void> {
  const { error } = await supabaseManutencao
    .from("checklist_image_inspections")
    .update({
      status: "processed",
      model_name: result.model_name ?? null,
      confidence: result.confidence ?? null,
      detections: result.detections ?? [],
      summary: result.summary ?? null,
      error_message: null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`markChecklistImageInspectionProcessed: ${error.message}`);
}

export async function markChecklistImageInspectionFailed(id: string, message: string): Promise<void> {
  const { error } = await supabaseManutencao
    .from("checklist_image_inspections")
    .update({
      status: "failed",
      error_message: message,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`markChecklistImageInspectionFailed: ${error.message}`);
}

export async function createSignedChecklistImageUrl(path: string, expiresIn = 60 * 15): Promise<string> {
  const { data, error } = await supabaseManutencao.storage
    .from(CHECKLIST_IMAGES_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`createSignedChecklistImageUrl: ${error?.message ?? "URL assinada indisponivel"}`);
  }

  return data.signedUrl;
}

function labelFromSource(sourceType: ChecklistImageSourceType): string {
  switch (sourceType) {
    case "hodometro":
      return "Foto do hodometro";
    case "abastecimento":
      return "Foto do comprovante";
    case "item":
    default:
      return "Foto do item";
  }
}

function sanitizeSegment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}
