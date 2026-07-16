import { reportCalendarDate, shiftCalendarDate } from "@/lib/report-date";

export type ScheduleFrequency = "DIARIO" | "SEMANAL" | "QUINZENAL" | "MENSAL";

type ScheduleDateInput = {
  frequencia: ScheduleFrequency;
  hora_envio: string;
  dia_semana?: number | null;
  dia_mes?: number | null;
};

export function nextScheduleRun(schedule: ScheduleDateInput, from: Date): Date {
  const timeMatch = schedule.hora_envio.match(/^(\d{2}):(\d{2})/);
  if (!timeMatch) throw new Error("Horário da agenda inválido.");
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) throw new Error("Horário da agenda inválido.");

  const today = reportCalendarDate(from);
  if (schedule.frequencia === "DIARIO") {
    const candidate = manausDateTime(today, hour, minute);
    return candidate > from ? candidate : manausDateTime(shiftCalendarDate(today, 1), hour, minute);
  }

  if (schedule.frequencia === "SEMANAL") {
    const desired = schedule.dia_semana ?? calendarWeekday(today);
    if (!Number.isInteger(desired) || desired < 0 || desired > 6) throw new Error("Dia da semana inválido.");
    let delta = (desired - calendarWeekday(today) + 7) % 7;
    let candidate = manausDateTime(shiftCalendarDate(today, delta), hour, minute);
    if (candidate <= from) {
      delta += 7;
      candidate = manausDateTime(shiftCalendarDate(today, delta), hour, minute);
    }
    return candidate;
  }

  if (schedule.frequencia === "QUINZENAL") {
    const candidate = manausDateTime(today, hour, minute);
    return candidate > from ? candidate : manausDateTime(shiftCalendarDate(today, 15), hour, minute);
  }

  const desiredDay = schedule.dia_mes ?? Number(today.slice(8, 10));
  if (!Number.isInteger(desiredDay) || desiredDay < 1 || desiredDay > 31) throw new Error("Dia do mês inválido.");
  let candidate = monthlyCandidate(today, desiredDay, hour, minute, 0);
  if (candidate <= from) candidate = monthlyCandidate(today, desiredDay, hour, minute, 1);
  return candidate;
}

function calendarWeekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function monthlyCandidate(date: string, desiredDay: number, hour: number, minute: number, monthOffset: number): Date {
  const [year, month] = date.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
  const targetYear = base.getUTCFullYear();
  const targetMonth = base.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDate = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(Math.min(desiredDay, lastDay)).padStart(2, "0")}`;
  return manausDateTime(targetDate, hour, minute);
}

function manausDateTime(date: string, hour: number, minute: number): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour + 4, minute));
}

