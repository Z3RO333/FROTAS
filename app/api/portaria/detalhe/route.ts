import { NextRequest, NextResponse } from "next/server";
import { requireAppUser, canAccessPortaria } from "@/lib/rbac";
import { getChecklistDetalhePortaria } from "@/lib/repos/portaria-detail";

export async function GET(request: NextRequest) {
  // Verifica perfil — motoristas não devem ver checklist de outros via API
  const user = await requireAppUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!canAccessPortaria(user.perfil)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
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
