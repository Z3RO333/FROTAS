import { describe, expect, it } from "vitest";
import { KM_SALTO_IMPOSSIVEL, KM_VARIACAO_INCOMUM, validateKm } from "@/lib/checklists/rules";

describe("validateKm", () => {
  it("aceita variação normal de turno", () => {
    expect(validateKm(233_362, 233_305)).toEqual({ ok: true, diff: 57 });
  });

  it("exige justificativa quando o KM é menor que o último", () => {
    expect(validateKm(233_000, 233_305).ok).toBe(false);
    expect(validateKm(233_000, 233_305, "hodômetro trocado").ok).toBe(true);
  });

  it("exige justificativa em variação incomum, mas aceita com justificativa", () => {
    const km = 233_305 + KM_VARIACAO_INCOMUM + 1;
    expect(validateKm(km, 233_305).reason).toBe("VARIACAO_INCOMUM");
    expect(validateKm(km, 233_305, "viagem para Porto Velho").ok).toBe(true);
  });

  it("recusa salto acima do teto mesmo com justificativa", () => {
    // frota 112: 233.363.362 gravado sobre 233.305 porque os dígitos concatenaram
    const validation = validateKm(233_363_362, 233_305, "estava assim no painel");
    expect(validation.ok).toBe(false);
    expect(validation.reason).toBe("SALTO_IMPOSSIVEL");
  });

  it("recusa o caso real da frota 108 (dígitos duplicados na leitura)", () => {
    // hodômetro mostrava 189.214; foi gravado 18.921.414
    expect(validateKm(18_921_414, 189_156, "qualquer texto").ok).toBe(false);
  });

  it("sinaliza SALTO_IMPOSSIVEL acima do teto, com ou sem justificativa", () => {
    const anterior = 100_000;
    const km = anterior + KM_SALTO_IMPOSSIVEL + 1;
    expect(validateKm(km, anterior).reason).toBe("SALTO_IMPOSSIVEL");
    expect(validateKm(km, anterior, "justifica").reason).toBe("SALTO_IMPOSSIVEL");
  });

  it("aceita, com justificativa, viagem longa dentro do teto", () => {
    const anterior = 100_000;
    expect(validateKm(anterior + KM_SALTO_IMPOSSIVEL, anterior, "redistribuição de frota").ok).toBe(true);
  });

  it("não aplica o teto quando não há KM anterior (primeiro registro)", () => {
    expect(validateKm(233_362, null)).toEqual({ ok: true, diff: null });
  });

  it("expõe o teto de 50.000 km por turno", () => {
    expect(KM_SALTO_IMPOSSIVEL).toBe(50_000);
  });
});
