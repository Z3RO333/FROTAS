import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, createNonce } from "@/lib/csp";

function directive(policy: string, name: string): string {
  return policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `)) ?? "";
}

describe("Content-Security-Policy", () => {
  it("gera nonces imprevisíveis e seguros para o cabeçalho", () => {
    const first = createNonce();
    const second = createNonce();

    expect(first).toMatch(/^[a-f0-9]{32}$/);
    expect(second).toMatch(/^[a-f0-9]{32}$/);
    expect(first).not.toBe(second);
  });

  it("remove unsafe-inline de scripts e elementos de estilo", () => {
    const policy = buildContentSecurityPolicy("abc123");

    expect(directive(policy, "script-src")).toBe(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic'"
    );
    expect(directive(policy, "style-src")).toBe("style-src 'self' 'nonce-abc123'");
    expect(directive(policy, "style-src-elem")).toBe(
      "style-src-elem 'self' 'nonce-abc123'"
    );
    expect(directive(policy, "script-src-attr")).toBe("script-src-attr 'none'");
  });

  it("permite testar atributos de estilo em modo estrito", () => {
    const policy = buildContentSecurityPolicy("abc123", {
      allowInlineStyleAttributes: false,
    });

    expect(directive(policy, "style-src-attr")).toBe("style-src-attr 'none'");
  });

  it("aceita somente uma origem web válida do Supabase", () => {
    const policy = buildContentSecurityPolicy("abc123", {
      supabaseUrl: "https://projeto.supabase.co/rest/v1",
    });
    const injected = buildContentSecurityPolicy("abc123", {
      supabaseUrl: "https://projeto.supabase.co; script-src *",
    });

    expect(policy).toContain("https://projeto.supabase.co");
    expect(policy).toContain("wss://projeto.supabase.co");
    expect(injected).not.toContain("projeto.supabase.co");
  });

  it("limita unsafe-eval ao desenvolvimento", () => {
    expect(buildContentSecurityPolicy("abc123")).not.toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy("abc123", { development: true })).toContain(
      "'unsafe-eval'"
    );
  });
});
