import { NextResponse } from "next/server";
import { analyzeOdometerImage, calcStatusLeitura } from "@/lib/ai/odometer";
import { auth } from "@/lib/auth";
import { fileFromForm, validateImageFile } from "@/lib/upload-validation";

// Rate limiter in-memory: máximo 10 chamadas por usuário por minuto
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(email: string): boolean {
  const now = Date.now();

  // Limpeza preguiçosa de entradas expiradas — sem isso o Map cresce
  // indefinidamente com o número de e-mails únicos (leak lento em produção).
  if (rateLimitMap.size > 500) {
    for (const [key, value] of rateLimitMap) {
      if (now > value.resetAt) rateLimitMap.delete(key);
    }
  }

  const entry = rateLimitMap.get(email);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!checkRateLimit(session.user.email)) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = fileFromForm(formData.get("foto_km"));
    if (!file) {
      return NextResponse.json({ error: "Envie a foto do painel." }, { status: 400 });
    }

    await validateImageFile(file, "Foto do hodômetro");

    const kmAnteriorRaw = formData.get("km_anterior");
    const kmAnterior =
      kmAnteriorRaw != null && String(kmAnteriorRaw).trim() !== ""
        ? parseInt(String(kmAnteriorRaw), 10) || null
        : null;

    const reading = await analyzeOdometerImage(file);
    const status_leitura = calcStatusLeitura(reading, kmAnterior);

    return NextResponse.json({ ...reading, status_leitura, km_anterior_usado: kmAnterior });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível analisar a foto.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
