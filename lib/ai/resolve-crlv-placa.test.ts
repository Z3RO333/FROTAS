import { describe, expect, it } from "vitest";
import { verificarPlacaCrlv } from "./resolve-crlv-placa";
import type { CrlvReading } from "./crlv-ocr";

function reading(overrides: Partial<CrlvReading> = {}): CrlvReading {
  return {
    data_vencimento: "2026-05-15",
    data_emissao: null,
    placa: "ABC1D23",
    confianca: 0.95,
    leitura_segura: true,
    motivo: null,
    ...overrides,
  };
}

describe("verificarPlacaCrlv", () => {
  it("não sinaliza divergência quando a placa lida bate com a informada", () => {
    expect(verificarPlacaCrlv(reading(), "ABC1D23")).toEqual({ divergente: false, placaLida: "ABC1D23" });
  });

  it("ignora formatação (traço, espaço, minúsculas) ao comparar", () => {
    expect(verificarPlacaCrlv(reading({ placa: "abc-1d23" }), "ABC 1D23")).toEqual({
      divergente: false,
      placaLida: "abc-1d23",
    });
  });

  it("sinaliza divergência quando a placa lida com confiança é diferente da informada", () => {
    expect(verificarPlacaCrlv(reading({ placa: "XYZ9999" }), "ABC1D23")).toEqual({
      divergente: true,
      placaLida: "XYZ9999",
    });
  });

  it("não sinaliza divergência quando a confiança da leitura é baixa", () => {
    expect(verificarPlacaCrlv(reading({ placa: "XYZ9999", confianca: 0.4 }), "ABC1D23")).toEqual({
      divergente: false,
      placaLida: "XYZ9999",
    });
  });

  it("não sinaliza divergência quando a IA não conseguiu ler a placa", () => {
    expect(verificarPlacaCrlv(reading({ placa: null }), "ABC1D23")).toEqual({
      divergente: false,
      placaLida: null,
    });
  });
});
