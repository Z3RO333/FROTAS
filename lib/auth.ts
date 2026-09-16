import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { normalizeUserDisplayName } from "@/lib/user";
import { requiredEnv } from "@/lib/env";
import { verificarCredenciaisTerceiro } from "@/lib/repos/usuarios";
import { recordSecurityEvent } from "@/lib/repos/security-events";

async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwardedFor = h.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() || null : h.get("x-real-ip");
    return { ip, userAgent: h.get("user-agent") };
  } catch {
    // headers() fora de um contexto de requisição (ex.: alguns pontos do fluxo OAuth) — não bloqueia o login.
    return { ip: null, userAgent: null };
  }
}

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
        const { ip, userAgent } = await requestMeta();
        if (!email || !senha) {
          await recordSecurityEvent({
            tipo_evento: "LOGIN_FALHA",
            email: email || null,
            provider: "motorista-terceiro",
            motivo: "Campos em branco",
            ip_address: ip,
            user_agent: userAgent,
          });
          return null;
        }

        const usuario = await verificarCredenciaisTerceiro(email, senha);
        if (!usuario) {
          await recordSecurityEvent({
            tipo_evento: "LOGIN_FALHA",
            email,
            provider: "motorista-terceiro",
            motivo: "Credenciais inválidas",
            ip_address: ip,
            user_agent: userAgent,
          });
          return null;
        }

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
      const allowed = isAllowedCorporateEmail(email);
      if (!allowed) {
        const { ip, userAgent } = await requestMeta();
        await recordSecurityEvent({
          tipo_evento: "LOGIN_BLOQUEADO_DOMINIO",
          email: email || null,
          provider: account?.provider ?? "microsoft-entra-id",
          motivo: "E-mail fora do domínio corporativo permitido",
          ip_address: ip,
          user_agent: userAgent,
        });
      }
      return allowed;
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
  events: {
    // Só dispara quando o login é de fato confirmado (nos dois providers) —
    // falha de senha e bloqueio por domínio já são logados em authorize()/signIn acima.
    async signIn({ user, profile, account }) {
      const email = account?.provider === "motorista-terceiro" ? user?.email ?? "" : profileEmail(user, profile);
      const { ip, userAgent } = await requestMeta();
      await recordSecurityEvent({
        tipo_evento: "LOGIN_SUCESSO",
        email: email || null,
        provider: account?.provider ?? null,
        ip_address: ip,
        user_agent: userAgent,
      });
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
