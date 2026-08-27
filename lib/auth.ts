import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { normalizeUserDisplayName } from "@/lib/user";
import { requiredEnv } from "@/lib/env";
import { verificarCredenciaisTerceiro } from "@/lib/repos/usuarios";

const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN || "bemol.com.br").toLowerCase();
const authBaseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
const secureOAuthCookies = authBaseUrl.startsWith("https://");
const oauthCookieOptions = {
  httpOnly: true,
  sameSite: secureOAuthCookies ? "none" : "lax",
  secure: secureOAuthCookies,
  path: "/",
} as const;

function profileEmail(
  user?: { email?: string | null } | null,
  profile?: Record<string, unknown> | null
): string {
  const preferredUsername =
    typeof profile?.preferred_username === "string" ? profile.preferred_username : null;
  const email = user?.email ?? (typeof profile?.email === "string" ? profile.email : null) ?? preferredUsername;
  return email?.normalize("NFKC").trim().toLowerCase() ?? "";
}

function isAllowedCorporateEmail(email: string): boolean {
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return Boolean(local && /^[a-z0-9._%+-]+$/.test(local) && domain === allowedDomain);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    MicrosoftEntraID({
      clientId: requiredEnv("AZURE_AD_CLIENT_ID"),
      clientSecret: requiredEnv("AZURE_AD_CLIENT_SECRET"),
      issuer: `https://login.microsoftonline.com/${requiredEnv("AZURE_AD_TENANT")}/v2.0`,
    }),
    Credentials({
      id: "motorista-terceiro",
      name: "Motorista terceiro",
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const senha = typeof credentials?.senha === "string" ? credentials.senha : "";
        if (!email || !senha) return null;

        const usuario = await verificarCredenciaisTerceiro(email, senha);
        if (!usuario) return null;

        return { id: usuario.id, email: usuario.email, name: usuario.nome ?? usuario.email };
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, profile, account }) {
      // Credenciais de terceiro já foram validadas em authorize() acima — não passam
      // pelo filtro de domínio corporativo, que só se aplica ao login via Microsoft.
      if (account?.provider === "motorista-terceiro") return true;
      const email = profileEmail(user, profile);
      return isAllowedCorporateEmail(email);
    },
    async jwt({ token, user, profile }) {
      const email = profileEmail(user, profile);
      if (email) token.email = email;
      token.name = normalizeUserDisplayName(user?.name ?? token.name, token.email);
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
        session.user.name = normalizeUserDisplayName(token.name, token.email);
      }
      return session;
    },
  },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 horas (jornada de trabalho)
  secret: requiredEnv("NEXTAUTH_SECRET"),
  // Produção HTTPS usa SameSite=None; desenvolvimento HTTP precisa de cookie não seguro.
  cookies: {
    pkceCodeVerifier: {
      name: "next-auth.pkce.code_verifier",
      options: oauthCookieOptions,
    },
    state: {
      name: "next-auth.state",
      options: oauthCookieOptions,
    },
  },
});
