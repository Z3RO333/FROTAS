export type CspOptions = {
  development?: boolean;
  supabaseUrl?: string;
  allowInlineStyleAttributes?: boolean;
};

function safeWebOrigin(rawUrl?: string): string | null {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function createNonce(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function buildContentSecurityPolicy(nonce: string, options: CspOptions = {}): string {
  if (!/^[A-Za-z0-9+/_=-]+$/.test(nonce)) {
    throw new Error("Nonce CSP inválido");
  }

  const isDev = options.development ?? false;
  const supabaseOrigin = safeWebOrigin(options.supabaseUrl);
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];

  if (isDev) scriptSources.push("'unsafe-eval'");

  const directives: string[][] = [
    ["default-src", "'self'"],
    ["script-src", ...scriptSources],
    ["script-src-attr", "'none'"],
    ["style-src", "'self'", `'nonce-${nonce}'`],
    ["style-src-elem", "'self'", `'nonce-${nonce}'`],
    [
      "style-src-attr",
      options.allowInlineStyleAttributes === true ? "'unsafe-inline'" : "'none'",
    ],
    ["img-src", "'self'", "data:", "blob:", ...(supabaseOrigin ? [supabaseOrigin] : [])],
    ["font-src", "'self'"],
    [
      "connect-src",
      "'self'",
      ...(supabaseOrigin
        ? [
            supabaseOrigin,
            supabaseOrigin.replace("https://", "wss://").replace("http://", "ws://"),
          ]
        : []),
      "https://api.openai.com",
      "https://login.microsoftonline.com",
    ],
    ["frame-src", "'self'", ...(supabaseOrigin ? [supabaseOrigin] : [])],
    ["worker-src", "'self'", "blob:"],
    ["manifest-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["frame-ancestors", "'none'"],
    ["form-action", "'self'"],
    ...(isDev ? [] : [["upgrade-insecure-requests"]]),
  ];

  return directives.map((directive) => directive.join(" ")).join("; ");
}
