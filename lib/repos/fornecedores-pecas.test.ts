import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-manutencao", () => ({
  supabaseManutencao: { from: vi.fn() },
}));

import { describe, expect, it } from "vitest";
import { normalizeFornecedorInput, dedupeNovosFornecedores } from "@/lib/repos/fornecedores-pecas";

describe("normalizeFornecedorInput", () => {
  it("trims the name and lowercases/trims the email", () => {
    const result = normalizeFornecedorInput({ nome: "  Peças Rio  ", email: "  Vendas@PecasRio.com.br  " });
    expect(result).toEqual({ nome: "Peças Rio", email: "vendas@pecasrio.com.br" });
  });
});

describe("dedupeNovosFornecedores", () => {
  it("keeps the first occurrence when the same email repeats with different casing", () => {
    const result = dedupeNovosFornecedores([
      { nome: "Peças Rio", email: "vendas@pecasrio.com.br" },
      { nome: "Peças Rio Ltda", email: "Vendas@PecasRio.com.br" },
    ]);
    expect(result).toEqual([{ nome: "Peças Rio", email: "vendas@pecasrio.com.br" }]);
  });

  it("keeps distinct emails", () => {
    const result = dedupeNovosFornecedores([
      { nome: "Peças Rio", email: "vendas@pecasrio.com.br" },
      { nome: "Auto Norte", email: "compras@autonorte.com.br" },
    ]);
    expect(result).toHaveLength(2);
  });
});
