import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getChecklistDetalhePortaria } from "@/lib/repos/portaria-detail";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const checklistId = Number(searchParams.get("checklist_id"));
  const frotaId = Number(searchParams.get("frota_id"));

  if (!checklistId || !frotaId) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  try {
    const detalhe = await getChecklistDetalhePortaria(checklistId, frotaId);
    return NextResponse.json(detalhe);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao buscar detalhe.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
