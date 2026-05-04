export const REPORT_TIME_ZONE = "America/Manaus";

export function formatReportDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: REPORT_TIME_ZONE });
}
