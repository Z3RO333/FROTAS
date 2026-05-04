import { describe, expect, it } from "vitest";
import { formatReportDate } from "@/lib/report-date";

describe("formatReportDate", () => {
  it("formats dates using the Manaus timezone", () => {
    const date = new Date("2026-05-03T03:45:00.000Z");

    expect(formatReportDate(date)).toBe("02/05/2026");
  });
});
