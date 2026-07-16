import { describe, expect, it } from "vitest";
import { nextScheduleRun } from "./schedule-date";

describe("nextScheduleRun", () => {
  it("agenda diária respeita o fuso de Manaus", () => {
    expect(nextScheduleRun({ frequencia: "DIARIO", hora_envio: "07:00" }, new Date("2026-07-16T10:00:00Z")).toISOString())
      .toBe("2026-07-16T11:00:00.000Z");
  });

  it("agenda semanal respeita o dia escolhido", () => {
    expect(nextScheduleRun({ frequencia: "SEMANAL", hora_envio: "07:00", dia_semana: 1 }, new Date("2026-07-16T12:00:00Z")).toISOString())
      .toBe("2026-07-20T11:00:00.000Z");
  });

  it("agenda mensal preserva o dia 31 após fevereiro", () => {
    const february = nextScheduleRun({ frequencia: "MENSAL", hora_envio: "07:00", dia_mes: 31 }, new Date("2027-01-31T12:00:00Z"));
    expect(february.toISOString()).toBe("2027-02-28T11:00:00.000Z");
    expect(nextScheduleRun({ frequencia: "MENSAL", hora_envio: "07:00", dia_mes: 31 }, february).toISOString())
      .toBe("2027-03-31T11:00:00.000Z");
  });
});

