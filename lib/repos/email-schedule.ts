import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { nextScheduleRun, type ScheduleFrequency } from "@/lib/schedule-date";

export type EmailSchedule = {
  id: number;
  nome: string;
  tipo: string;
  destinatarios: string[];
  frequencia: ScheduleFrequency;
  dia_semana: number | null;
  dia_mes: number | null;
  hora_envio: string;
  cds_incluidos: string[];
  setores_incluidos: string[];
  ativo: boolean;
  ultimo_envio: string | null;
  proximo_envio: string | null;
  criado_por: string | null;
  criado_em: string;
  processing_token: string | null;
  processing_started_at: string | null;
};

export async function listEmailSchedules(): Promise<EmailSchedule[]> {
  const { data, error } = await supabaseManutencao
    .from("email_schedules")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw new Error(`listEmailSchedules: ${error.message}`);
  return (data ?? []) as EmailSchedule[];
}

export async function getEmailSchedule(id: number): Promise<EmailSchedule | null> {
  const { data, error } = await supabaseManutencao
    .from("email_schedules")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getEmailSchedule: ${error.message}`);
  return (data ?? null) as EmailSchedule | null;
}

export async function createEmailSchedule(
  input: Omit<EmailSchedule, "id" | "ultimo_envio" | "proximo_envio" | "criado_em" | "processing_token" | "processing_started_at">
): Promise<void> {
  const { error } = await supabaseManutencao.from("email_schedules").insert({
    ...input,
    proximo_envio: nextScheduleRun(input, new Date()).toISOString(),
  });
  if (error) throw new Error(`createEmailSchedule: ${error.message}`);
}

export async function updateEmailSchedule(
  id: number,
  input: Pick<
    EmailSchedule,
    "nome" | "tipo" | "destinatarios" | "frequencia" | "dia_semana" | "dia_mes" | "hora_envio" | "cds_incluidos" | "setores_incluidos" | "ativo"
  >
): Promise<void> {
  const { error } = await supabaseManutencao
    .from("email_schedules")
    .update({
      ...input,
      atualizado_em: new Date().toISOString(),
      proximo_envio: input.ativo ? nextScheduleRun(input, new Date()).toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(`updateEmailSchedule: ${error.message}`);
}

export async function claimDueEmailSchedules(args: {
  limit?: number;
  tipo?: string;
  excludeTipo?: string;
} = {}): Promise<EmailSchedule[]> {
  const { data, error } = await supabaseManutencao.rpc("claim_email_schedules", {
    p_limit: args.limit ?? 25,
    p_tipo: args.tipo ?? null,
    p_exclude_tipo: args.excludeTipo ?? null,
  });
  if (error) throw new Error(`claimDueEmailSchedules: ${error.message}`);
  return (data ?? []) as EmailSchedule[];
}

export async function completeEmailSchedule(schedule: EmailSchedule, sentAt: Date): Promise<void> {
  if (!schedule.processing_token) throw new Error("Agenda sem token de processamento.");
  const { data, error } = await supabaseManutencao
    .from("email_schedules")
    .update({
      ultimo_envio: sentAt.toISOString(),
      proximo_envio: nextScheduleRun(schedule, sentAt).toISOString(),
      atualizado_em: sentAt.toISOString(),
      processing_token: null,
      processing_started_at: null,
    })
    .eq("id", schedule.id)
    .eq("processing_token", schedule.processing_token)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`completeEmailSchedule: ${error.message}`);
  if (!data) throw new Error("A agenda perdeu o claim antes de concluir.");
}

export async function releaseEmailScheduleClaim(schedule: EmailSchedule): Promise<void> {
  if (!schedule.processing_token) return;
  const { error } = await supabaseManutencao
    .from("email_schedules")
    .update({ processing_token: null, processing_started_at: null })
    .eq("id", schedule.id)
    .eq("processing_token", schedule.processing_token);
  if (error) throw new Error(`releaseEmailScheduleClaim: ${error.message}`);
}

export async function toggleEmailSchedule(id: number, ativo: boolean): Promise<void> {
  const updates: Record<string, unknown> = { ativo, atualizado_em: new Date().toISOString() };
  if (ativo) {
    const { data: schedule, error: fetchError } = await supabaseManutencao
      .from("email_schedules")
      .select("frequencia,hora_envio,dia_semana,dia_mes")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw new Error(`toggleEmailSchedule: ${fetchError.message}`);
    if (!schedule) throw new Error("Agenda não encontrada.");
    updates.proximo_envio = nextScheduleRun(schedule as EmailSchedule, new Date()).toISOString();
  }
  const { error } = await supabaseManutencao
    .from("email_schedules")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error(`toggleEmailSchedule: ${error.message}`);
}

export async function deleteEmailSchedule(id: number): Promise<void> {
  const { error } = await supabaseManutencao.from("email_schedules").delete().eq("id", id);
  if (error) throw new Error(`deleteEmailSchedule: ${error.message}`);
}
