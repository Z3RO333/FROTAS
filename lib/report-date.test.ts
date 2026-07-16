import { describe, expect, it } from "vitest";
import {
  formatReportDate,
  reportCalendarDate,
  reportDayUtcRange,
  shiftCalendarDate,
} from "@/lib/report-date";

describe("formatReportDate", () => {
  it("formats dates using the Manaus timezone", () => {
    const date = new Date("2026-05-03T03:45:00.000Z");

    expect(formatReportDate(date)).toBe("02/05/2026");
  });
});

describe("reportCalendarDate", () => {
  it("keeps late evening UTC on the previous day in Manaus", () => {
    expect(reportCalendarDate(new Date("2026-05-03T03:59:59.999Z"))).toBe("2026-05-02");
    expect(reportCalendarDate(new Date("2026-05-03T04:00:00.000Z"))).toBe("2026-05-03");
  });
});

describe("reportDayUtcRange", () => {
  it("returns exactly one Manaus calendar day with an exclusive end", () => {
    expect(reportDayUtcRange("2026-05-03")).toEqual({
      start: "2026-05-03T04:00:00.000Z",
      end: "2026-05-04T04:00:00.000Z",
    });
  });

  it("rejects impossible calendar dates", () => {
    expect(() => reportDayUtcRange("2026-02-30")).toThrow("Data inválida");
  });
});

describe("shiftCalendarDate", () => {
  it("crosses month and year boundaries", () => {
    expect(shiftCalendarDate("2026-01-01", -1)).toBe("2025-12-31");
  });
});
