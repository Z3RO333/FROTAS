import { describe, expect, it } from "vitest";
import { PedidoLoteSchema } from "./_schema";

function baseGrupo(overrides: Record<string, unknown> = {}) {
  return {
    tokenIdempotencia: "b6e1c9b0-6e0a-4c8e-9a2e-8f2a2a2a2a2a",
    frotaId: 1,
    itens: [{ descricao: "Lanterna LED", quantidade: 1 }],
    fornecedorIds: [10],
    novosFornecedores: [],
    ...overrides,
  };
}

describe("PedidoLoteSchema fornecedores", () => {
  it("accepts a grupo with at least one fornecedorId selected", () => {
    const result = PedidoLoteSchema.safeParse({ grupos: [baseGrupo()] });
    expect(result.success).toBe(true);
  });

  it("accepts a grupo whose only fornecedor is a novoFornecedor", () => {
    const result = PedidoLoteSchema.safeParse({
      grupos: [baseGrupo({ fornecedorIds: [], novosFornecedores: [{ nome: "Peças Rio", email: "vendas@pecasrio.com.br" }] })],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a grupo with no fornecedor selected and none added", () => {
    const result = PedidoLoteSchema.safeParse({
      grupos: [baseGrupo({ fornecedorIds: [], novosFornecedores: [] })],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Selecione ao menos um fornecedor para cotação.");
    }
  });
});
