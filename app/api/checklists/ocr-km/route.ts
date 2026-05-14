import { NextResponse } from "next/server";
import { analyzeOdometerImage } from "@/lib/ai/odometer";
import { auth } from "@/lib/auth";
import { fileFromForm, validateImageFile } from "@/lib/upload-validation";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = fileFromForm(formData.get("foto_km"));
    if (!file) {
      return NextResponse.json({ error: "Envie a foto do painel." }, { status: 400 });
    }

    validateImageFile(file, "Foto do hodômetro");
    const reading = await analyzeOdometerImage(file);
    return NextResponse.json(reading);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível analisar a foto.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
