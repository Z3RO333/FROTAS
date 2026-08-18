import { describe, expect, it } from "vitest";
import { CrlvReadingSchema, applyConfidenceThreshold } from "./crlv-ocr";

describe("CrlvReadingSchema", () => {
  it("aceita uma resposta válida da IA", () => {
    const result = CrlvReadingSchema.safeParse({
      data_vencimento: "2026-05-15",
      confianca: 0.95,
      leitura_segura: true,
      motivo: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita data em formato errado", () => {
    const result = CrlvReadingSchema.safeParse({
      data_vencimento: "15/05/2026",
      confianca: 0.95,
      leitura_segura: true,
      motivo: null,
    });
    expect(result.success).toBe(false);
  });

  it("aceita data_vencimento nula quando a IA não encontrou o campo", () => {
    const result = CrlvReadingSchema.safeParse({
      data_vencimento: null,
      confianca: 0.2,
      leitura_segura: false,
      motivo: "Documento ilegível",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita confiança fora do intervalo 0-1", () => {
    const result = CrlvReadingSchema.safeParse({
      data_vencimento: "2026-05-15",
      confianca: 1.5,
      leitura_segura: true,
      motivo: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("applyConfidenceThreshold", () => {
  it("mantém leitura_segura quando confiança >= 0.7 e há data", () => {
    const reading = { data_vencimento: "2026-05-15", confianca: 0.9, leitura_segura: true, motivo: null };
    expect(applyConfidenceThreshold(reading).leitura_segura).toBe(true);
  });

  it("derruba leitura_segura quando confiança < 0.7, mesmo que a IA tenha marcado true", () => {
    const reading = { data_vencimento: "2026-05-15", confianca: 0.5, leitura_segura: true, motivo: null };
    expect(applyConfidenceThreshold(reading).leitura_segura).toBe(false);
  });

  it("derruba leitura_segura quando não há data_vencimento", () => {
    const reading = { data_vencimento: null, confianca: 0.95, leitura_segura: true, motivo: null };
    expect(applyConfidenceThreshold(reading).leitura_segura).toBe(false);
  });
});
