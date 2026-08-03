import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()",
  },
];

const ALLOWED_ORIGINS = [
  ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  ...(process.env.VERCEL_URL ? [process.env.VERCEL_URL] : []),
];

const config: NextConfig = {
  // Reduz fingerprinting da tecnologia usada pelo servidor.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Limite total coerente com 8 imagens de sinistro, fotos do checklist e
      // dois PDFs validados no servidor. Em evolução futura, mover para upload
      // direto assinado para não manter arquivos grandes na Server Action.
      bodySizeLimit: "90mb",
      ...(ALLOWED_ORIGINS.length > 0 ? { allowedOrigins: ALLOWED_ORIGINS } : {}),
    },
  },
  serverExternalPackages: ["@databricks/sql", "@resvg/resvg-js"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default config;
