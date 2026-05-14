import { supabaseManutencao } from "@/lib/supabase-manutencao";

export async function logEmail(args: {
  tipo: "geral" | "individual";
  frotaId?: number | null;
  destinatarios: string;
  assunto: string;
  enviadoPor: string;
  status: "enviado" | "erro";
  erroMsg?: string | null;
}) {
  const { error } = await supabaseManutencao
    .from("email_logs")
    .insert({
      tipo: args.tipo,
      frota_id: args.frotaId ?? null,
      destinatarios: args.destinatarios,
      assunto: args.assunto,
      enviado_por: args.enviadoPor,
      status: args.status,
      erro_msg: args.erroMsg ?? null,
    });

  if (error) throw error;
}
