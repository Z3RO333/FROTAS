import { describe, expect, it } from "vitest";
import { calcStatusLeitura, type OdometerReading } from "./odometer";

function reading(overrides: Partial<OdometerReading> = {}): OdometerReading {
  return {
    km_lido: 101_000,
    confianca: 0.95,
    leitura_segura: true,
    precisa_digitacao_manual: false,
    motivo: null,
    texto_visivel: "101000",
    candidatos_descartados: [],
    regiao_detectada: "hodometro_digital",
    ...overrides,
  };
}

describe("calcStatusLeitura", () => {
  it("aceita uma leitura segura e compatível com o KM anterior", () => {
    expect(calcStatusLeitura(reading(), 100_000)).toBe("LEITURA_SEGURA");
  });

  it("não promove a leitura marcada pela IA como insegura", () => {
    expect(
      calcStatusLeitura(
        reading({ leitura_segura: false, precisa_digitacao_manual: true }),
        100_000
      )
    ).toBe("LEITURA_SUSPEITA");
  });
});
