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
