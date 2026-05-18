import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type EmailSchedule = {
  id: number;
  nome: string;
  tipo: string;
  destinatarios: string[];
  frequencia: "DIARIO" | "SEMANAL" | "QUINZENAL" | "MENSAL" | "PERSONALIZADO";
  dia_semana: number | null;
  hora_envio: string;
  cds_incluidos: string[];
  ativo: boolean;
  ultimo_envio: string | null;
  proximo_envio: string | null;
  criado_por: string | null;
  criado_em: string;
};

export async function listEmailSchedules(): Promise<EmailSchedule[]> {
  const { data, error } = await supabaseManutencao
    .from("email_schedules")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) {
    console.warn("[email-schedule] falha ao listar", error.message);
    return [];
  }
  return (data ?? []) as EmailSchedule[];
}

export async function createEmailSchedule(
  input: Omit<EmailSchedule, "id" | "ultimo_envio" | "proximo_envio" | "criado_em">
): Promise<void> {
  const { error } = await supabaseManutencao.from("email_schedules").insert(input);
  if (error) throw new Error(`createEmailSchedule: ${error.message}`);
}

export async function toggleEmailSchedule(id: number, ativo: boolean): Promise<void> {
  const { error } = await supabaseManutencao
    .from("email_schedules")
    .update({ ativo, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`toggleEmailSchedule: ${error.message}`);
}

export async function deleteEmailSchedule(id: number): Promise<void> {
  const { error } = await supabaseManutencao.from("email_schedules").delete().eq("id", id);
  if (error) throw new Error(`deleteEmailSchedule: ${error.message}`);
}
