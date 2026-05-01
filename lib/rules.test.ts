import { describe, it, expect } from "vitest";
import { calcularStatus, parseVenda, calcularIdade, THRESHOLDS } from "./rules";

describe("calcularIdade", () => {
  it("retorna anoAtual menos anoFabricacao", () => {
    expect(calcularIdade(2019, 2026)).toBe(7);
    expect(calcularIdade(2026, 2026)).toBe(0);
  });
  it("retorna null se ano nulo", () => {
    expect(calcularIdade(null, 2026)).toBe(null);
  });
});

describe("calcularStatus", () => {
  it("retorna 'critico' quando idade > 10", () => {
    expect(calcularStatus(11, 100_000)).toBe("critico");
  });
  it("retorna 'critico' quando km > 600k", () => {
    expect(calcularStatus(2, 700_000)).toBe("critico");
  });
  it("retorna 'atencao' quando idade > 7", () => {
    expect(calcularStatus(8, 100_000)).toBe("atencao");
  });
  it("retorna 'atencao' quando km > 400k", () => {
    expect(calcularStatus(2, 500_000)).toBe("atencao");
  });
  it("retorna 'disponivel' quando dentro dos limites", () => {
    expect(calcularStatus(3, 100_000)).toBe("disponivel");
  });
  it("retorna 'disponivel' quando idade null e km baixo", () => {
    expect(calcularStatus(null, 50_000)).toBe("disponivel");
  });
});

describe("parseVenda", () => {
  it("detecta VENDA com ano", () => {
    expect(parseVenda("VENDA 2026")).toEqual({ vendido: true, anoVenda: 2026 });
    expect(parseVenda("VENDA 2025/2")).toEqual({ vendido: true, anoVenda: 2025 });
  });
  it("detecta VENDA sem ano", () => {
    expect(parseVenda("VENDA")).toEqual({ vendido: true, anoVenda: null });
  });
  it("detecta case-insensitive", () => {
    expect(parseVenda("venda 2024")).toEqual({ vendido: true, anoVenda: 2024 });
  });
  it("retorna não vendido para localização normal", () => {
    expect(parseVenda("AM - MANAUS")).toEqual({ vendido: false, anoVenda: null });
  });
  it("retorna não vendido para null", () => {
    expect(parseVenda(null)).toEqual({ vendido: false, anoVenda: null });
  });
});

describe("THRESHOLDS", () => {
  it("expõe constantes esperadas", () => {
    expect(THRESHOLDS.idadeAtencao).toBe(7);
    expect(THRESHOLDS.idadeCritico).toBe(10);
    expect(THRESHOLDS.kmAtencao).toBe(400_000);
    expect(THRESHOLDS.kmCritico).toBe(600_000);
  });
});
