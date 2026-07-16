export const REPORT_TIME_ZONE = "America/Manaus";

const CALENDAR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatReportDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: REPORT_TIME_ZONE });
}

export function reportCalendarDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function shiftCalendarDate(date: string, days: number): string {
  assertCalendarDate(date);
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function reportDayUtcRange(date: string): { start: string; end: string } {
  assertCalendarDate(date);
  const [year, month, day] = date.split("-").map(Number);
  // America/Manaus é UTC-4 e não possui horário de verão.
  const start = new Date(Date.UTC(year, month - 1, day, 4));
  const end = new Date(Date.UTC(year, month - 1, day + 1, 4));
  return { start: start.toISOString(), end: end.toISOString() };
}

function assertCalendarDate(date: string): void {
  if (!CALENDAR_DATE_RE.test(date)) throw new Error("Data inválida. Use YYYY-MM-DD.");
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Data inválida. Use uma data real no formato YYYY-MM-DD.");
  }
}
