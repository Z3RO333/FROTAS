import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { canManageUsers, requireAppUser } from "@/lib/rbac";
import { getFrotasDoMotorista } from "@/lib/repos/motoristas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireAppUser().catch(() => null);
  if (!user) return apiError("Não autenticado.", 401, "AUTH_REQUIRED");
  if (!canManageUsers(user.perfil)) return apiError("Acesso negado.", 403, "FORBIDDEN");

  const motoristaId = request.nextUrl.searchParams.get("motorista_id")?.trim();
  if (!motoristaId) return apiError("Motorista não informado.", 400, "INVALID_MOTORISTA");

  try {
    const frotas = await getFrotasDoMotorista(motoristaId);
    return NextResponse.json({ frotas });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar frotas do motorista.";
    return apiError(message, 500, "MOTORISTA_FROTAS_FAILED", error);
  }
}
