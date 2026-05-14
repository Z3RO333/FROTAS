import "dotenv/config";
import { supabaseManutencao } from "../lib/supabase-manutencao";

async function main() {
  const { data, error } = await supabaseManutencao
    .from("email_logs")
    .select("enviado_em,tipo,destinatarios,assunto,status,erro_msg")
    .order("enviado_em", { ascending: false })
    .limit(5);

  if (error) throw error;

  if (!data?.length) {
    console.log("Nenhum log de envio encontrado.");
    return;
  }

  for (const row of data) {
    console.log("---");
    console.log("Quando       :", row.enviado_em);
    console.log("Tipo         :", row.tipo);
    console.log("Destinatarios:", row.destinatarios);
    console.log("Assunto      :", row.assunto);
    console.log("Status       :", row.status);
    if (row.status === "erro") {
      console.log("ERRO REAL    :", row.erro_msg);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
