import { NextResponse } from "next/server";
import {
  createSignedChecklistImageUrl,
  listQueuedChecklistImageInspections,
  markChecklistImageInspectionFailed,
  markChecklistImageInspectionProcessed,
  markChecklistImageInspectionProcessing,
} from "@/lib/repos/checklist-images";
import { analyzeChecklistImageWithYolo } from "@/lib/vision/yolo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.CHECKLIST_VISION_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CHECKLIST_VISION_SECRET nao configurado." }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token !== secret) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Number.isInteger(body.limit) ? Math.min(Math.max(Number(body.limit), 1), 25) : 10;
  const rows = await listQueuedChecklistImageInspections(limit);
  const results: Array<{ id: string; status: "processed" | "failed"; error?: string }> = [];

  for (const inspection of rows) {
    try {
      await markChecklistImageInspectionProcessing(inspection.id);
      const imageUrl = await createSignedChecklistImageUrl(inspection.storage_path);
      const yoloResult = await analyzeChecklistImageWithYolo({ inspection, imageUrl });
      await markChecklistImageInspectionProcessed(inspection.id, yoloResult);
      results.push({ id: inspection.id, status: "processed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha inesperada na analise YOLO.";
      await markChecklistImageInspectionFailed(inspection.id, message);
      results.push({ id: inspection.id, status: "failed", error: message });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
