import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { normalizeUserDisplayName } from "@/lib/user";

const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN || "bemol.com.br").toLowerCase();

function profileEmail(
  user?: { email?: string | null } | null,
  profile?: Record<string, unknown> | null
): string {
  const preferredUsername =
    typeof profile?.preferred_username === "string" ? profile.preferred_username : null;
  const email = user?.email ?? (typeof profile?.email === "string" ? profile.email : null) ?? preferredUsername;
  return email?.toLowerCase() ?? "";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT}/v2.0`,
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, profile }) {
      const email = profileEmail(user, profile);
      return email.endsWith(`@${allowedDomain}`);
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
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
});
