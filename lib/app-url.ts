export function getAppUrl(): string {
  const configured = process.env.FROTAS_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  const value = configured ?? vercel ?? "http://localhost:3000";
  const normalized = value.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/i.test(normalized)) {
    throw new Error("FROTAS_APP_URL deve apontar para a URL pública em produção.");
  }
  return normalized;
}
