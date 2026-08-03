import { auth } from "@/lib/auth";
import { buildContentSecurityPolicy, createNonce } from "@/lib/csp";
import { NextResponse } from "next/server";

const TRUSTED_HOSTS = trustedHostsFromEnvironment();

function trustedHostsFromEnvironment(): Set<string> {
  const hosts = new Set<string>();
  const addHost = (value: string | undefined) => {
    const raw = value?.trim();
    if (!raw) return;
    try {
      const parsed = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
      hosts.add(parsed.host.toLowerCase());
    } catch {
      // Configuração inválida não amplia a allowlist.
    }
  };

  for (const value of (process.env.FROTAS_TRUSTED_HOSTS ?? "").split(",")) addHost(value);
  for (const value of (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "").split(",")) addHost(value);
  addHost(process.env.FROTAS_APP_URL);
  addHost(process.env.NEXT_PUBLIC_APP_URL);
  addHost(process.env.NEXTAUTH_URL);
  addHost(process.env.WEBSITE_HOSTNAME);
  return hosts;
}

function isTrustedRequestHost(req: Parameters<Parameters<typeof auth>[0]>[0]): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (TRUSTED_HOSTS.size === 0) return false;

  const rawHosts = [
    req.headers.get("host"),
    req.headers.get("x-forwarded-host")?.split(",")[0],
    req.nextUrl.host,
  ].filter((value): value is string => Boolean(value?.trim()));

  return rawHosts.every((value) => TRUSTED_HOSTS.has(value.trim().toLowerCase()));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const nonce = createNonce();
  // Produção sempre aplica a política; Report-Only é exclusivo de homologação.
  const reportOnly = process.env.NODE_ENV !== "production" && process.env.CSP_REPORT_ONLY === "1";
  const headerName = reportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce, {
    development: process.env.NODE_ENV === "development",
    supabaseUrl:
      process.env.NEXT_PUBLIC_SUPABASE_MANUTENCAO_URL ??
      process.env.SUPABASE_MANUTENCAO_URL,
    // Estrito por padrão. O opt-out temporário deve ser explícito fora de produção.
    allowInlineStyleAttributes:
      process.env.NODE_ENV !== "production" && process.env.CSP_STRICT_STYLE_ATTRS === "0",
  });
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-time", String(Date.now()));
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
    pathname === "/api/email/send-scheduled";

  if (!isTrustedRequestHost(req)) {
    const response = new NextResponse("Host não permitido.", { status: 400 });
    response.headers.set(headerName, contentSecurityPolicy);
    return response;
  }

  if (!req.auth?.user?.email && !isPublic) {
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
