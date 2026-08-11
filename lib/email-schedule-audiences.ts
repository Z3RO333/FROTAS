import type { EmailSchedule } from "@/lib/repos/email-schedule";

function normalizedEmails(emails: string[] | undefined): string[] {
  return [...new Set((emails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export function getOperationalScheduleAudiences(schedule: EmailSchedule): Array<{
  setor: string | null;
  destinatarios: string[];
}> {
  if (schedule.setores_incluidos.length === 0) {
    return [{ setor: null, destinatarios: normalizedEmails(schedule.destinatarios) }];
  }

  return schedule.setores_incluidos.map((setor) => ({
    setor,
    // Compatibilidade com agendas anteriores à vinculação explícita.
    destinatarios: normalizedEmails(
      schedule.destinatarios_por_setor?.[setor]?.length
        ? schedule.destinatarios_por_setor[setor]
        : schedule.destinatarios
    ),
  }));
}
