// Helpers pequenos pra evitar que cada tela manipule URLSearchParams do seu jeito.
// Ver plano de evolução de UX/navegação — estado compartilhável vive na URL.

export function withQuery(
  pathname: string,
  current: URLSearchParams,
  patch: Record<string, string | number | null | undefined>
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

// Só aceita destinos relativos e internos — bloqueia protocol-relative ("//host")
// e absolutos ("https://...") pra evitar open redirect via returnTo.
export function safeReturnTo(value?: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

// Preserve only fleet-list destinations when returning from a mutation.
export function frotaReturnTo(value?: string | null): string | null {
  if (!value || /[\\\u0000-\u0020]/.test(value)) return null;
  const pathname = value.split(/[?#]/, 1)[0];
  return ["/frotas", "/frotas/vendidos", "/frotas/ocultas"].includes(pathname) ? value : null;
}

export function frotaDetailHref(id: number, returnTo?: string | null): string {
  const destination = frotaReturnTo(returnTo);
  return `/frotas/${id}${destination ? `?returnTo=${encodeURIComponent(destination)}` : ""}`;
}
