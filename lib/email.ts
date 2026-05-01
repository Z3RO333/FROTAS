import sg from "@sendgrid/mail";
import { renderRelatorioGeral, renderRelatorioIndividual } from "@/lib/email-templates";
import type { Frota } from "@/lib/repos/frotas";
import { logEmail } from "@/lib/repos/email-logs";

const FROM = process.env.FROM_EMAIL || "ordensmanutencao@bemol.com.br";

type SendResult = { ok: true } | { ok: false; error: string };

let configured = false;

function mailClient() {
  if (!configured) {
    sg.setApiKey(process.env.SENDGRID_API_KEY?.trim() ?? "");
    configured = true;
  }
  return sg;
}

export async function sendRelatorioGeral(args: {
  destinatarios: string[];
  frotas: Frota[];
  enviadoPor: string;
}): Promise<SendResult> {
  const assunto = `Relatorio geral de frotas - ${new Date().toLocaleDateString("pt-BR")}`;
  const html = renderRelatorioGeral(args.frotas, new Date());
  const destinatarios = args.destinatarios.join(",");

  try {
    await mailClient().send({ from: FROM, to: args.destinatarios, subject: assunto, html });
    await logEmail({
      tipo: "geral",
      destinatarios,
      assunto,
      enviadoPor: args.enviadoPor,
      status: "enviado",
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logEmail({
      tipo: "geral",
      destinatarios,
      assunto,
      enviadoPor: args.enviadoPor,
      status: "erro",
      erroMsg: msg,
    });
    return { ok: false, error: msg };
  }
}

export async function sendRelatorioIndividual(args: {
  destinatarios: string[];
  frota: Frota;
  enviadoPor: string;
}): Promise<SendResult> {
  const assunto = `Frota ${args.frota.placa ?? args.frota.id} - relatorio`;
  const html = renderRelatorioIndividual(args.frota);
  const destinatarios = args.destinatarios.join(",");

  try {
    await mailClient().send({ from: FROM, to: args.destinatarios, subject: assunto, html });
    await logEmail({
      tipo: "individual",
      frotaId: args.frota.id,
      destinatarios,
      assunto,
      enviadoPor: args.enviadoPor,
      status: "enviado",
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logEmail({
      tipo: "individual",
      frotaId: args.frota.id,
      destinatarios,
      assunto,
      enviadoPor: args.enviadoPor,
      status: "erro",
      erroMsg: msg,
    });
    return { ok: false, error: msg };
  }
}
