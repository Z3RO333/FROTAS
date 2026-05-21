import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type EmailLog = {
  id: number;
  tipo: string;
  frota_id: number | null;
  cd_nome: string | null;
  destinatarios: string | null;
  assunto: string | null;
  enviado_em: string;
  enviado_por: string | null;
  status: string | null;
  erro_msg: string | null;
  resumo: string | null;
  conteudo_html: string | null;
  schedule_id: number | null;
};

export async function logEmail(args: {
  tipo: "geral" | "individual" | "diario_ia" | "disponibilidade_cd" | "painel_executivo";
  frotaId?: number | null;
  cdNome?: string | null;
  destinatarios: string;
  assunto: string;
  enviadoPor: string;
  status: "enviado" | "erro";
  erroMsg?: string | null;
  resumo?: string | null;
  conteudoHtml?: string | null;
  scheduleId?: number | null;
}) {
  const { error } = await supabaseManutencao
    .from("email_logs")
    .insert({
      tipo: args.tipo,
      frota_id: args.frotaId ?? null,
      cd_nome: args.cdNome ?? null,
      destinatarios: args.destinatarios,
      assunto: args.assunto,
      enviado_por: args.enviadoPor,
      status: args.status,
      erro_msg: args.erroMsg ?? null,
      resumo: args.resumo ?? null,
      conteudo_html: args.conteudoHtml ?? null,
      schedule_id: args.scheduleId ?? null,
    });

  if (error) throw error;
}

export async function listEmailLogs(limit = 50, tipo?: string): Promise<EmailLog[]> {
  let query = supabaseManutencao
    .from("email_logs")
    .select("id,tipo,frota_id,cd_nome,destinatarios,assunto,enviado_em,enviado_por,status,erro_msg,resumo,conteudo_html,schedule_id")
    .order("enviado_em", { ascending: false })
    .limit(limit);

  if (tipo) query = query.eq("tipo", tipo);

  const { data, error } = await query;
  if (error) {
    console.warn("[email-logs] falha ao listar", error.message);
    return [];
  }

  return (data ?? []) as EmailLog[];
}
