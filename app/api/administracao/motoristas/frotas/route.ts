import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { authenticateApiUser } from "@/lib/api-auth";
import { canManageUsers } from "@/lib/rbac";
import { getFrotasDoMotorista } from "@/lib/repos/motoristas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authentication = await authenticateApiUser();
  if (!authentication.ok) return authentication.response;
  if (!canManageUsers(authentication.user.perfil)) return apiError("Acesso negado.", 403, "FORBIDDEN");

  const motoristaId = request.nextUrl.searchParams.get("motorista_id")?.trim();
  if (!motoristaId) return apiError("Motorista não informado.", 400, "INVALID_MOTORISTA");

  try {
    const frotas = await getFrotasDoMotorista(motoristaId);
    return NextResponse.json({ frotas });
  } catch (error) {
    return apiError("Erro ao carregar frotas do motorista.", 500, "MOTORISTA_FROTAS_FAILED", error);
  }
}
