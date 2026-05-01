import { execute } from "@/lib/db";

export async function logEmail(args: {
  tipo: "geral" | "individual";
  frotaId?: number | null;
  destinatarios: string;
  assunto: string;
  enviadoPor: string;
  status: "enviado" | "erro";
  erroMsg?: string | null;
}) {
  await execute(
    `INSERT INTO manutencao.cd.email_logs
      (tipo, frota_id, destinatarios, assunto, enviado_em, enviado_por, status, erro_msg)
     VALUES (?, ?, ?, ?, current_timestamp(), ?, ?, ?)`,
    [
      args.tipo,
      args.frotaId ?? null,
      args.destinatarios,
      args.assunto,
      args.enviadoPor,
      args.status,
      args.erroMsg ?? null,
    ]
  );
}
