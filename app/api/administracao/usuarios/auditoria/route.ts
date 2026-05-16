import { NextResponse } from "next/server";
import { canManageUsers, requireAppUser } from "@/lib/rbac";
import { listUsuarioAuditoria } from "@/lib/repos/usuarios";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireAppUser();
  if (!canManageUsers(user.perfil)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  const entries = await listUsuarioAuditoria(id, 50);
  return NextResponse.json({ ok: true, entries });
}
