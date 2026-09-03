import { NextResponse } from "next/server";
import { analyzeOdometerImage, calcStatusLeitura } from "@/lib/ai/odometer";
import { authenticateApiUser } from "@/lib/api-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";
import { fileFromForm, UploadValidationError, validateImageFile } from "@/lib/upload-validation";

const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 60;
const MAX_REQUEST_BYTES = 6 * 1024 * 1024;

export async function POST(request: Request) {
  const authentication = await authenticateApiUser();
  if (!authentication.ok) return authentication.response;

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return apiError("Requisição acima de 6 MB.", 413, "REQUEST_TOO_LARGE");
  }

  let allowed: boolean;
  try {
    allowed = await consumeRateLimit({
      key: `ocr-km:${authentication.user.email}`,
      limit: RATE_LIMIT,
      windowSeconds: RATE_WINDOW_SECONDS,
    });
  } catch (error) {
    console.error("[ocr-km] rate limit indisponivel", error);
    return apiError("Serviço temporariamente indisponível.", 503, "RATE_LIMIT_UNAVAILABLE", error);
  }

  if (!allowed) {
    return apiError("Muitas requisições. Tente novamente em instantes.", 429, "RATE_LIMITED");
  }

  try {
    const formData = await request.formData();
    const file = fileFromForm(formData.get("foto_km"));
    if (!file) {
      return apiError("Envie a foto do painel.", 400, "IMAGE_REQUIRED");
    }

    await validateImageFile(file, "Foto do hodômetro");

    const kmAnteriorRaw = formData.get("km_anterior");
    const kmText = kmAnteriorRaw == null ? "" : String(kmAnteriorRaw).trim();
    const kmAnterior = kmText === "" ? null : Number(kmText);
    if (kmAnterior != null && (!Number.isSafeInteger(kmAnterior) || kmAnterior < 0)) {
      return apiError("KM anterior inválido.", 400, "INVALID_PREVIOUS_KM");
    }

    const reading = await analyzeOdometerImage(file, kmAnterior);
    const status_leitura = calcStatusLeitura(reading, kmAnterior);

    return NextResponse.json({ ...reading, status_leitura, km_anterior_usado: kmAnterior });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível analisar a foto.";
    if (error instanceof UploadValidationError) {
      return apiError(message, 400, "INVALID_UPLOAD");
    }
    console.error("[ocr-km] falha no processamento", error);
    return apiError("Serviço de leitura temporariamente indisponível.", 502, "OCR_UNAVAILABLE", error);
  }
}
