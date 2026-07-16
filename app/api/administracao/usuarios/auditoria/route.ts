import { NextResponse } from "next/server";
import { canManageUsers, requireAppUser } from "@/lib/rbac";
import { listUsuarioAuditoria } from "@/lib/repos/usuarios";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireAppUser().catch(() => null);
  if (!user) return apiError("Não autenticado.", 401, "AUTH_REQUIRED");
  if (!canManageUsers(user.perfil)) {
    return apiError("Acesso negado.", 403, "FORBIDDEN");
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return apiError("Parâmetro id obrigatório.", 400, "MISSING_ID");
  }

  const entries = await listUsuarioAuditoria(id, 50);
  return NextResponse.json({ ok: true, entries });
}
