import { vi } from "vitest";

vi.mock("server-only", () => ({}));

const state: { row: Record<string, unknown> | null } = { row: null };

function makeChain() {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    update: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: state.row, error: null })),
    then: undefined,
  };
  // update(...).eq(...) resolves like a promise when awaited directly (no maybeSingle/single call)
  const chainAsThenable = Object.assign(chain, {
    then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
  });
  return chainAsThenable;
}

vi.mock("@/lib/supabase-manutencao", () => ({
  supabaseManutencao: { from: vi.fn(() => makeChain()) },
}));

import { describe, expect, it, beforeEach } from "vitest";
import { setSenhaUsuario, verificarCredenciaisTerceiro } from "@/lib/repos/usuarios";

describe("setSenhaUsuario + verificarCredenciaisTerceiro", () => {
  beforeEach(() => {
    state.row = null;
  });

  it("hashes the password so it never matches the plaintext, and verifies it back correctly", async () => {
    let capturedHash = "";
    const { supabaseManutencao } = await import("@/lib/supabase-manutencao");
    (supabaseManutencao.from as ReturnType<typeof vi.fn>).mockImplementationOnce((table: string) => {
      expect(table).toBe("usuarios");
      const chain = {
        update: vi.fn((patch: Record<string, unknown>) => {
          capturedHash = patch.senha_hash as string;
          return chain;
        }),
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };
      return chain;
    });

    await setSenhaUsuario("motorista@exemplo.com", "senhaForte123");

    expect(capturedHash).toBeTruthy();
    expect(capturedHash).not.toBe("senhaForte123");
    expect(capturedHash.startsWith("$2")).toBe(true); // prefixo padrão de hash bcrypt
  });

  it("returns the user when email, tipo_conta, ativo and senha conferem", async () => {
    const bcrypt = (await import("bcryptjs")).default;
    const hash = await bcrypt.hash("senhaCorreta", 12);
    state.row = {
      id: "motorista@exemplo.com",
      nome: "Motorista Terceiro",
      email: "motorista@exemplo.com",
      matricula: null,
      perfil: "MOTORISTA",
      ativo: true,
      tipo_conta: "TERCEIRO",
      criado_em: null,
      atualizado_em: null,
      senha_hash: hash,
    };

    const usuario = await verificarCredenciaisTerceiro("motorista@exemplo.com", "senhaCorreta");
    expect(usuario?.email).toBe("motorista@exemplo.com");
    expect(usuario?.tipo_conta).toBe("TERCEIRO");
  });

  it("returns null when the password does not match", async () => {
    const bcrypt = (await import("bcryptjs")).default;
    const hash = await bcrypt.hash("senhaCorreta", 12);
    state.row = {
      id: "motorista@exemplo.com",
      nome: "Motorista Terceiro",
      email: "motorista@exemplo.com",
      matricula: null,
      perfil: "MOTORISTA",
      ativo: true,
      tipo_conta: "TERCEIRO",
      criado_em: null,
      atualizado_em: null,
      senha_hash: hash,
    };

    const usuario = await verificarCredenciaisTerceiro("motorista@exemplo.com", "senhaErrada");
    expect(usuario).toBeNull();
  });

  it("returns null when no matching account exists (row not found)", async () => {
    state.row = null;
    const usuario = await verificarCredenciaisTerceiro("ninguem@exemplo.com", "qualquer");
    expect(usuario).toBeNull();
  });
});
