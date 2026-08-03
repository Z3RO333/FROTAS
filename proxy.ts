import { auth } from "@/lib/auth";
import { buildContentSecurityPolicy, createNonce } from "@/lib/csp";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const nonce = createNonce();
  const reportOnly = process.env.CSP_REPORT_ONLY === "1";
  const headerName = reportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce, {
    development: process.env.NODE_ENV === "development",
    supabaseUrl:
      process.env.NEXT_PUBLIC_SUPABASE_MANUTENCAO_URL ??
      process.env.SUPABASE_MANUTENCAO_URL,
    // Bibliotecas de UI ainda usam style para posicionamento e gráficos.
    // CSP_STRICT_STYLE_ATTRS=1 permite medir essa compatibilidade em homologação.
    allowInlineStyleAttributes: process.env.CSP_STRICT_STYLE_ATTRS !== "1",
  });
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(headerName, contentSecurityPolicy);
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/acesso-bloqueado" ||
    pathname.startsWith("/api/auth/") ||
    // Rotas internas protegidas por FROTAS_INTERNAL_SECRET no proprio handler.
    // Liberadas aqui pra que o secret check rode (sem isso, sessao redireciona pra /login).
    pathname === "/api/relatorios/daily" ||
    pathname === "/api/checklists/analyze" ||
    pathname === "/api/checklists/vision/process" ||
    pathname === "/api/email/send-scheduled" ||
    pathname === "/api/geocode/reverse";

  if (!req.auth && !isPublic) {
    const url = new URL("/login", req.url);
    const response = NextResponse.redirect(url);
    response.headers.set(headerName, contentSecurityPolicy);
    return response;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(headerName, contentSecurityPolicy);
  return response;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
