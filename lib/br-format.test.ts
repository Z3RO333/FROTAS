import { describe, expect, it } from "vitest";
import { formatCPF, formatTelefoneBR, isValidCPF, isValidTelefoneBR } from "./br-format";

describe("formatCPF", () => {
  it("aplica a mascara progressivamente", () => {
    expect(formatCPF("111")).toBe("111");
    expect(formatCPF("11144")).toBe("111.44");
    expect(formatCPF("11144477")).toBe("111.444.77");
    expect(formatCPF("11144477735")).toBe("111.444.777-35");
  });

  it("ignora caracteres nao numericos e trunca em 11 digitos", () => {
    expect(formatCPF("111.444.777-35extra")).toBe("111.444.777-35");
  });
});

describe("isValidCPF", () => {
  it("aceita um CPF valido", () => {
    expect(isValidCPF("111.444.777-35")).toBe(true);
  });

  it("rejeita digitos verificadores incorretos", () => {
    expect(isValidCPF("111.444.777-36")).toBe(false);
  });

  it("rejeita sequencias repetidas", () => {
    expect(isValidCPF("111.111.111-11")).toBe(false);
  });

  it("rejeita tamanho invalido", () => {
    expect(isValidCPF("123")).toBe(false);
  });
});

describe("formatTelefoneBR", () => {
  it("formata celular (11 digitos)", () => {
    expect(formatTelefoneBR("92991234567")).toBe("(92) 99123-4567");
  });

  it("formata fixo (10 digitos)", () => {
    expect(formatTelefoneBR("9232345678")).toBe("(92) 3234-5678");
  });
});

describe("isValidTelefoneBR", () => {
  it("aceita celular e fixo com DDD valido", () => {
    expect(isValidTelefoneBR("92991234567")).toBe(true);
    expect(isValidTelefoneBR("9232345678")).toBe(true);
  });

  it("rejeita DDD invalido", () => {
    expect(isValidTelefoneBR("00991234567")).toBe(false);
  });

  it("rejeita tamanho invalido", () => {
    expect(isValidTelefoneBR("123456")).toBe(false);
  });
});
