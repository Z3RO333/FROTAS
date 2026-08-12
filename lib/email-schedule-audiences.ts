import type { EmailSchedule } from "@/lib/repos/email-schedule";

function normalizedEmails(emails: string[] | undefined): string[] {
  return [...new Set((emails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

function destinatariosGroupKey(destinatarios: string[]): string {
  return [...destinatarios].sort().join(",");
}

/**
 * Agrupa os setores selecionados por conjunto de destinatários antes do envio.
 *
 * Vários setores que compartilham exatamente os mesmos destinatários formam um
 * único grupo (1 e-mail consolidado com os dados de todos os setores do grupo).
 * Setores com destinatários diferentes formam grupos distintos, cada um com seu
 * próprio disparo. Isso evita o antigo comportamento de 1 e-mail por setor, que
 * gerava múltiplos disparos duplicados para o mesmo destinatário.
 */
export function getOperationalScheduleAudiences(schedule: EmailSchedule): Array<{
  setores: string[] | null;
  destinatarios: string[];
}> {
  if (schedule.setores_incluidos.length === 0) {
    return [{ setores: null, destinatarios: normalizedEmails(schedule.destinatarios) }];
  }

  const grupos = new Map<string, { setores: string[]; destinatarios: string[] }>();

  for (const setor of schedule.setores_incluidos) {
    // Compatibilidade com agendas anteriores à vinculação explícita.
    const destinatarios = normalizedEmails(
      schedule.destinatarios_por_setor?.[setor]?.length
        ? schedule.destinatarios_por_setor[setor]
        : schedule.destinatarios
    );
    const key = destinatariosGroupKey(destinatarios);
    const grupo = grupos.get(key);
    if (grupo) grupo.setores.push(setor);
    else grupos.set(key, { setores: [setor], destinatarios });
  }

  return [...grupos.values()];
}
