import { NextResponse } from "next/server";
import { authenticateApiUser } from "@/lib/api-auth";
import { canManageUsers } from "@/lib/rbac";
import { listUsuarioAuditoria } from "@/lib/repos/usuarios";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authentication = await authenticateApiUser();
  if (!authentication.ok) return authentication.response;
  if (!canManageUsers(authentication.user.perfil)) {
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
