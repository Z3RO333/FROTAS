import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/acesso-bloqueado" ||
    pathname.startsWith("/api/auth/") ||
    // Rotas internas protegidas por FROTAS_INTERNAL_SECRET no proprio handler.
    // Liberadas aqui pra que o secret check rode (sem isso, sessao redireciona pra /login).
    pathname === "/api/relatorios/daily" ||
    pathname === "/api/checklists/analyze" ||
    pathname === "/api/email/send-scheduled";

  if (!req.auth && !isPublic) {
    const url = new URL("/login", req.url);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
