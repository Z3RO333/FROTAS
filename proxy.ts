import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/acesso-bloqueado" ||
    pathname.startsWith("/api/auth/");

  if (!req.auth && !isPublic) {
    const url = new URL("/login", req.url);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
