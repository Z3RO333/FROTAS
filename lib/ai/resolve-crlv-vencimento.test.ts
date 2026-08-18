import { describe, expect, it } from "vitest";
import { resolveCrlvVencimento } from "./resolve-crlv-vencimento";
import type { CrlvReading } from "./crlv-ocr";

function reading(overrides: Partial<CrlvReading> = {}): CrlvReading {
  return {
    data_vencimento: "2026-05-15",
    data_emissao: null,
    confianca: 0.95,
    leitura_segura: true,
    motivo: null,
    ...overrides,
  };
}

describe("resolveCrlvVencimento", () => {
  it("usa a data da IA quando a leitura é segura, mesmo com data manual diferente", () => {
    const result = resolveCrlvVencimento(reading(), "2025-01-01");
    expect(result).toEqual({
      crlv_vencimento: "2026-05-15",
      crlv_vencimento_origem: "IA",
      crlv_vencimento_confianca: 0.95,
      crlv_revisar_manualmente: false,
    });
  });

  it("mantém a data manual e marca revisão quando a leitura não é segura", () => {
    const result = resolveCrlvVencimento(
      reading({ leitura_segura: false, confianca: 0.3, data_vencimento: null }),
      "2025-01-01"
    );
    expect(result).toEqual({
      crlv_vencimento: "2025-01-01",
      crlv_vencimento_origem: "MANUAL",
      crlv_vencimento_confianca: 0.3,
      crlv_revisar_manualmente: true,
    });
  });

  it("marca origem null quando a leitura falha e não há data manual", () => {
    const result = resolveCrlvVencimento(
      reading({ leitura_segura: false, confianca: 0, data_vencimento: null }),
      null
    );
    expect(result).toEqual({
      crlv_vencimento: null,
      crlv_vencimento_origem: null,
      crlv_vencimento_confianca: 0,
      crlv_revisar_manualmente: true,
    });
  });
});
