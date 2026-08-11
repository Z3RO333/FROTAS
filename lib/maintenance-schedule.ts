import { shiftCalendarDate } from "@/lib/report-date";

export type DateSchedule = {
  nextDate: string | null;
  overdueDays: number;
  status: "NO_PRAZO" | "VENCIDO" | "SEM_REGISTRO";
};

function calendarDayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function calendarDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

export function calculateDateSchedule(
  performedDate: string | null | undefined,
  intervalDays: number | null | undefined,
  today: string
): DateSchedule {
  const performed = calendarDate(performedDate);
  if (!performed) return { nextDate: null, overdueDays: 0, status: "SEM_REGISTRO" };

  const safeInterval = intervalDays && intervalDays > 0 ? Math.trunc(intervalDays) : 30;
  const nextDate = shiftCalendarDate(performed, safeInterval);
  const difference = calendarDayNumber(today) - calendarDayNumber(nextDate);

  return {
    nextDate,
    overdueDays: Math.max(0, difference),
    status: difference > 0 ? "VENCIDO" : "NO_PRAZO",
  };
}
