import { describe, expect, it } from "vitest";
import { CrlvReadingSchema, applyConfidenceThreshold, estimarVencimentoPorEmissao } from "./crlv-ocr";

describe("CrlvReadingSchema", () => {
  it("aceita uma resposta válida da IA", () => {
    const result = CrlvReadingSchema.safeParse({
      data_vencimento: "2026-05-15",
      data_emissao: null,
      confianca: 0.95,
      leitura_segura: true,
      motivo: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita data em formato errado", () => {
    const result = CrlvReadingSchema.safeParse({
      data_vencimento: "15/05/2026",
      data_emissao: null,
      confianca: 0.95,
      leitura_segura: true,
      motivo: null,
    });
    expect(result.success).toBe(false);
  });

  it("aceita data_vencimento nula quando a IA não encontrou o campo", () => {
    const result = CrlvReadingSchema.safeParse({
      data_vencimento: null,
      data_emissao: null,
      confianca: 0.2,
      leitura_segura: false,
      motivo: "Documento ilegível",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita confiança fora do intervalo 0-1", () => {
    const result = CrlvReadingSchema.safeParse({
      data_vencimento: "2026-05-15",
      data_emissao: null,
      confianca: 1.5,
      leitura_segura: true,
      motivo: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("applyConfidenceThreshold", () => {
  it("mantém leitura_segura quando confiança >= 0.7 e há data", () => {
    const reading = { data_vencimento: "2026-05-15", data_emissao: null, confianca: 0.9, leitura_segura: true, motivo: null };
    expect(applyConfidenceThreshold(reading).leitura_segura).toBe(true);
  });

  it("derruba leitura_segura quando confiança < 0.7, mesmo que a IA tenha marcado true", () => {
    const reading = { data_vencimento: "2026-05-15", data_emissao: null, confianca: 0.5, leitura_segura: true, motivo: null };
    expect(applyConfidenceThreshold(reading).leitura_segura).toBe(false);
  });

  it("derruba leitura_segura quando não há data_vencimento", () => {
    const reading = { data_vencimento: null, data_emissao: null, confianca: 0.95, leitura_segura: true, motivo: null };
    expect(applyConfidenceThreshold(reading).leitura_segura).toBe(false);
  });
});

describe("estimarVencimentoPorEmissao", () => {
  it("vence no último dia do mês de emissão, um ano depois — não no mesmo dia", () => {
    // Emitido 09/08/2025 → vence 31/08/2026, não 09/08/2026 (só fica
    // vencido de fato em 01/09/2026, no início do mês seguinte).
    expect(estimarVencimentoPorEmissao("2025-08-09")).toBe("2026-08-31");
  });

  it("lida com fevereiro em ano bissexto", () => {
    expect(estimarVencimentoPorEmissao("2023-02-10")).toBe("2024-02-29");
  });
});
