import "dotenv/config";
import { query } from "../lib/db";

async function main() {
  const rows = await query<{
    enviado_em: string;
    tipo: string;
    destinatarios: string;
    assunto: string;
    status: string;
    erro_msg: string | null;
  }>(
    `SELECT enviado_em, tipo, destinatarios, assunto, status, erro_msg
     FROM manutencao.cd.email_logs
     ORDER BY enviado_em DESC
     LIMIT 5`
  );

  if (rows.length === 0) {
    console.log("Nenhum log de envio encontrado.");
    return;
  }

  for (const r of rows) {
    console.log("---");
    console.log("Quando      :", r.enviado_em);
    console.log("Tipo        :", r.tipo);
    console.log("Destinatários:", r.destinatarios);
    console.log("Assunto     :", r.assunto);
    console.log("Status      :", r.status);
    if (r.status === "erro") {
      console.log("ERRO REAL   :", r.erro_msg);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
