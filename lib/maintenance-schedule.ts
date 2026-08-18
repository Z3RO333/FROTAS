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

export type KmSchedule = {
  nextKm: number | null;
  overdueKm: number;
  status: "NO_PRAZO" | "VENCIDO" | "SEM_REGISTRO";
};

export function calculateKmSchedule(
  performedKm: number | null | undefined,
  intervalKm: number | null | undefined,
  currentKm: number | null | undefined
): KmSchedule {
  if (performedKm == null) return { nextKm: null, overdueKm: 0, status: "SEM_REGISTRO" };

  const safeInterval = intervalKm && intervalKm > 0 ? Math.trunc(intervalKm) : 10_000;
  const nextKm = performedKm + safeInterval;
  // Sem KM atual não dá pra provar atraso — tratar como no prazo em vez de
  // arriscar falso positivo (mesma lição do CRLV: dado ausente não é vencido).
  if (currentKm == null) return { nextKm, overdueKm: 0, status: "NO_PRAZO" };

  const overdueKm = currentKm - nextKm;
  return { nextKm, overdueKm: Math.max(0, overdueKm), status: overdueKm > 0 ? "VENCIDO" : "NO_PRAZO" };
}
