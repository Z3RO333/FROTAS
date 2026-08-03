import { describe, expect, it } from "vitest";
import { safePostgrestTerm } from "./postgrest-filter";

describe("safePostgrestTerm", () => {
  it("remove delimitadores e operadores da gramática PostgREST", () => {
    expect(safePostgrestTerm("ABC),vendido.eq.true,(")).toBe("ABC vendido eq true");
  });

  it("preserva texto operacional e limita o tamanho", () => {
    expect(safePostgrestTerm("  Frota-123_Açu  ")).toBe("Frota-123_Açu");
    expect(safePostgrestTerm("a".repeat(200))).toHaveLength(100);
  });
});
