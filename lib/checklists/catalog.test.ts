import { describe, expect, it } from "vitest";
import { CHECKLIST_ITEMS, isCriticalChecklistProblem } from "@/lib/checklists/catalog";

describe("isCriticalChecklistProblem", () => {
  const kitSeguranca = CHECKLIST_ITEMS.find((item) => item.codigo === "kit_seguranca")!;
  const pneus = CHECKLIST_ITEMS.find((item) => item.codigo === "pneus_step")!;
  const motor = CHECKLIST_ITEMS.find((item) => item.codigo === "motor_oleo")!;

  it("bloqueia problema nos itens críticos", () => {
    expect(isCriticalChecklistProblem(kitSeguranca, "NAO_APTO")).toBe(true);
    expect(isCriticalChecklistProblem(pneus, "NAO_APTO")).toBe(true);
  });

  it("não bloqueia item crítico marcado como apto", () => {
    expect(isCriticalChecklistProblem(kitSeguranca, "APTO")).toBe(false);
  });

  it("não bloqueia problema em item não crítico", () => {
    expect(isCriticalChecklistProblem(motor, "NAO_APTO")).toBe(false);
  });
});

describe("obrigatoriedade dos itens", () => {
  it("só kit de segurança, pneus/step e documento são obrigatórios", () => {
    const obrigatorios = CHECKLIST_ITEMS.filter((item) => item.obrigatorio).map((item) => item.codigo);
    expect(obrigatorios.sort()).toEqual(["documento", "kit_seguranca", "pneus_step"]);
  });

  it("freios, motor, radiador e limpador não são obrigatórios nem críticos", () => {
    for (const codigo of ["freios", "motor_oleo", "radiador", "limpador"]) {
      const item = CHECKLIST_ITEMS.find((i) => i.codigo === codigo)!;
      expect(item.obrigatorio, codigo).toBe(false);
      expect(item.critico, codigo).toBe(false);
    }
  });

  it("críticos continuam sendo apenas kit de segurança e pneus/step", () => {
    const criticos = CHECKLIST_ITEMS.filter((item) => item.critico).map((item) => item.codigo);
    expect(criticos.sort()).toEqual(["kit_seguranca", "pneus_step"]);
  });
});
