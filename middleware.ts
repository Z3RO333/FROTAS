export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Protege todas as rotas de app (exceto login)
    "/(app)/:path*",
    // Protege rotas de API (exceto as de autenticação do NextAuth)
    "/api/((?!auth).*)",
  ],
};
