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

  it("aceita salto acima do teto quando há justificativa", () => {
    const validation = validateKm(233_363_362, 233_305, "estava assim no painel");
    expect(validation.ok).toBe(true);
  });

  it("exige justificativa para salto acima do teto, sinaliza SALTO_IMPOSSIVEL sem ela", () => {
    const anterior = 100_000;
    expect(validateKm(anterior + KM_SALTO_IMPOSSIVEL + 1, anterior).reason).toBe("SALTO_IMPOSSIVEL");
    expect(validateKm(anterior + KM_SALTO_IMPOSSIVEL + 1, anterior, "justifica").ok).toBe(true);
  });

  it("não aplica o teto quando não há KM anterior (primeiro registro)", () => {
    expect(validateKm(233_362, null)).toEqual({ ok: true, diff: null });
  });

  it("expõe o teto de 20.000 km por turno", () => {
    expect(KM_SALTO_IMPOSSIVEL).toBe(20_000);
  });
});
