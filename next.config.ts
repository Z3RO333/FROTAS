import type { NextConfig } from "next";

const SUPABASE_HOST = (process.env.NEXT_PUBLIC_SUPABASE_MANUTENCAO_URL ?? "")
  .replace(/^https?:\/\//, "")
  .split("/")[0];

// Next.js App Router requer 'unsafe-inline' em script-src (inline scripts para hidratação/streaming).
// Para CSP estrita (sem unsafe-inline), é necessário configurar nonces via middleware — melhoria futura.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${SUPABASE_HOST ? ` https://${SUPABASE_HOST}` : ""}`,
  `connect-src 'self'${SUPABASE_HOST ? ` https://${SUPABASE_HOST} wss://${SUPABASE_HOST}` : ""} https://api.openai.com https://login.microsoftonline.com`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Content-Security-Policy", value: CSP },
];

const ALLOWED_ORIGINS = [
  ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  ...(process.env.VERCEL_URL ? [process.env.VERCEL_URL] : []),
];

const config: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // fotos de câmera chegam a 2–5 MB cada; checklist envia até 3 fotos
      ...(ALLOWED_ORIGINS.length > 0 ? { allowedOrigins: ALLOWED_ORIGINS } : {}),
    },
  },
  serverExternalPackages: ["@databricks/sql", "@resvg/resvg-js"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default config;
