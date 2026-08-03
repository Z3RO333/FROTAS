import "server-only";
import type { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { resolveAppUser, type AppUser } from "@/lib/rbac";

export type ApiAuthentication =
  | { ok: true; user: AppUser }
  | { ok: false; response: NextResponse };

/**
 * Autentica APIs sem usar redirect(). Também consulta o cadastro atual para
 * impedir que um JWT ainda válido continue funcionando após a desativação.
 */
export async function authenticateApiUser(): Promise<ApiAuthentication> {
  try {
    const result = await resolveAppUser();
    if (result.ok) return result;

    if (result.reason === "INACTIVE") {
      return {
        ok: false,
        response: apiError("Acesso bloqueado.", 403, "ACCOUNT_INACTIVE"),
      };
    }

    return {
      ok: false,
      response: apiError("Não autenticado.", 401, "AUTH_REQUIRED"),
    };
  } catch (error) {
    return {
      ok: false,
      response: apiError(
        "Serviço de autenticação temporariamente indisponível.",
        503,
        "AUTH_SERVICE_UNAVAILABLE",
        error
      ),
    };
  }
}
