import { z } from "zod";
import type { ChecklistImageInspection } from "@/lib/repos/checklist-images";

const YoloDetectionSchema = z.object({
  class_name: z.string(),
  confidence: z.number().min(0).max(1),
  box: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
});

const YoloResponseSchema = z.object({
  model_name: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  summary: z.string().nullable().optional(),
  detections: z.array(YoloDetectionSchema).default([]),
});

export type YoloChecklistResult = z.infer<typeof YoloResponseSchema>;

export async function analyzeChecklistImageWithYolo(args: {
  inspection: ChecklistImageInspection;
  imageUrl: string;
}): Promise<YoloChecklistResult> {
  const endpoint = process.env.CHECKLIST_YOLO_ENDPOINT?.trim();
  if (!endpoint) {
    throw new Error("CHECKLIST_YOLO_ENDPOINT nao configurado.");
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = process.env.CHECKLIST_YOLO_TOKEN?.trim();
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      inspection_id: args.inspection.id,
      checklist_id: args.inspection.checklist_id,
      item_codigo: args.inspection.checklist_item_codigo,
      source_type: args.inspection.source_type,
      image_url: args.imageUrl,
    }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const message = json && typeof json === "object" && "error" in json ? String(json.error) : response.statusText;
    throw new Error(`YOLO falhou: ${message}`);
  }

  return YoloResponseSchema.parse(json);
}
