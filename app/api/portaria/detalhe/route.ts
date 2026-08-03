import { NextRequest, NextResponse } from "next/server";
import { authenticateApiUser } from "@/lib/api-auth";
import { canAccessPortaria } from "@/lib/rbac";
import { getChecklistDetalhePortaria } from "@/lib/repos/portaria-detail";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  // Verifica perfil — motoristas não devem ver checklist de outros via API
  const authentication = await authenticateApiUser();
  if (!authentication.ok) return authentication.response;
  if (!canAccessPortaria(authentication.user.perfil)) {
    return apiError("Acesso negado.", 403, "FORBIDDEN");
  }

  const { searchParams } = new URL(request.url);
  const checklistId = Number(searchParams.get("checklist_id"));
  const frotaId = Number(searchParams.get("frota_id"));

  if (!checklistId || !frotaId) {
    return apiError("Parâmetros inválidos.", 400, "INVALID_PARAMETERS");
  }

  try {
    const detalhe = await getChecklistDetalhePortaria(checklistId, frotaId);
    return NextResponse.json(detalhe);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao buscar detalhe.";
    const status = /não encontrado|nao encontrado/i.test(msg) ? 404 : 500;
    return apiError(
      status === 404 ? "Checklist não encontrado." : "Erro ao buscar detalhe.",
      status,
      status === 404 ? "NOT_FOUND" : "PORTARIA_DETAIL_FAILED",
      error
    );
  }
}
