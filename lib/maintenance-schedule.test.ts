import { describe, expect, it } from "vitest";
import { calculateDateSchedule, calendarDate } from "./maintenance-schedule";

describe("calculateDateSchedule", () => {
  it("calcula a próxima lavagem pelo intervalo da frota", () => {
    expect(calculateDateSchedule("2026-08-10", 30, "2026-08-11")).toEqual({
      nextDate: "2026-09-09",
      overdueDays: 0,
      status: "NO_PRAZO",
    });
  });

  it("não considera o dia seguinte como retorno da lavagem", () => {
    expect(calculateDateSchedule("2026-08-10T23:30:00-04:00", 30, "2026-08-11").nextDate)
      .toBe("2026-09-09");
  });

  it("calcula dias de atraso sem efeito de fuso horário", () => {
    expect(calculateDateSchedule("2026-07-01", 30, "2026-08-11")).toEqual({
      nextDate: "2026-07-31",
      overdueDays: 11,
      status: "VENCIDO",
    });
  });

  it("marca frota sem histórico", () => {
    expect(calculateDateSchedule(null, 30, "2026-08-11").status).toBe("SEM_REGISTRO");
  });
});

describe("calendarDate", () => {
  it("preserva a data civil de um timestamp", () => {
    expect(calendarDate("2026-08-10T23:30:00-04:00")).toBe("2026-08-10");
  });
});
