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

  it("recusa salto fisicamente impossível MESMO com justificativa", () => {
    // Caso real do checklist 584 (frota 112, 02/09/2026): o campo vinha
    // pré-preenchido com a leitura da IA (233363) e o motorista digitou por
    // cima, gerando 233363362. A justificativa livre autorizava qualquer
    // valor, o KM da frota foi sobrescrito para 233 milhões.
    const validation = validateKm(233_363_362, 233_305, "estava assim no painel");
    expect(validation.ok).toBe(false);
    expect(validation.reason).toBe("SALTO_IMPOSSIVEL");
  });

  it("mantém o salto impossível recusado no limite exato do teto", () => {
    const anterior = 100_000;
    expect(validateKm(anterior + KM_SALTO_IMPOSSIVEL, anterior, "justifica").ok).toBe(true);
    expect(validateKm(anterior + KM_SALTO_IMPOSSIVEL + 1, anterior, "justifica").reason).toBe(
      "SALTO_IMPOSSIVEL"
    );
  });

  it("não aplica o teto quando não há KM anterior (primeiro registro)", () => {
    expect(validateKm(233_362, null)).toEqual({ ok: true, diff: null });
  });

  it("expõe o teto de 20.000 km por turno", () => {
    expect(KM_SALTO_IMPOSSIVEL).toBe(20_000);
  });
});
