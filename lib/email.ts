import sg from "@sendgrid/mail";
import { readFile } from "fs/promises";
import { join } from "path";
import type { AttachmentData } from "@sendgrid/helpers/classes/attachment";
import { renderRelatorioGeral, renderRelatorioIndividual } from "@/lib/email-templates";
import type { Frota } from "@/lib/repos/frotas";
import { logEmail } from "@/lib/repos/email-logs";

const FROM = process.env.FROM_EMAIL || "ordensmanutencao@bemol.com.br";
const TRUCK_CID = "caminhao-bemol";

type SendResult = { ok: true } | { ok: false; error: string };

let configured = false;
let truckAttachmentPromise: Promise<AttachmentData | null> | null = null;

function mailClient() {
  if (!configured) {
    if (!process.env.SENDGRID_API_KEY?.trim()) {
      throw new Error("Configuração de e-mail incompleta: SENDGRID_API_KEY não foi definida.");
    }
    sg.setApiKey(process.env.SENDGRID_API_KEY?.trim() ?? "");
    configured = true;
  }
  return sg;
}

async function safeLogEmail(args: Parameters<typeof logEmail>[0]) {
  try {
    await logEmail(args);
  } catch (error) {
    console.error("Erro ao registrar log de e-mail", error);
  }
}

function sendGridErrorMessage(error: unknown): string {
  const responseErrors = (error as { response?: { body?: { errors?: Array<{ message?: string }> } } })?.response?.body
    ?.errors;
  const details = responseErrors?.map((item) => item.message).filter(Boolean).join("; ");

  if (details) return details;
  if (error instanceof Error) return error.message;
  return String(error);
}

function publicEmailErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("sender identity") || lower.includes("from address")) {
    return "O remetente do e-mail não está verificado no SendGrid.";
  }
  if (lower.includes("api key") || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return "Configuração de e-mail inválida. Verifique a chave do SendGrid.";
  }
  if (lower.includes("recipient") || lower.includes("email")) {
    return "Não foi possível enviar. Verifique os destinatários informados.";
  }
  return "Não foi possível enviar o relatório agora. Verifique a configuração de e-mail.";
}

function getTruckAttachment(): Promise<AttachmentData | null> {
  if (!truckAttachmentPromise) {
    truckAttachmentPromise = readFile(join(process.cwd(), "public", "assets", "caminhao-bemol.png"))
      .then((content) => ({
        content: content.toString("base64"),
        filename: "caminhao-bemol.png",
        type: "image/png",
        disposition: "inline",
        contentId: TRUCK_CID,
      }))
      .catch(() => null);
  }

  return truckAttachmentPromise;
}

export async function sendRelatorioGeral(args: {
  destinatarios: string[];
  frotas: Frota[];
  enviadoPor: string;
}): Promise<SendResult> {
  const assunto = `Relatório geral de frotas - ${new Date().toLocaleDateString("pt-BR")}`;
  const truckAttachment = await getTruckAttachment();
  const html = renderRelatorioGeral(args.frotas, new Date(), {
    truckImageSrc: truckAttachment ? `cid:${TRUCK_CID}` : undefined,
  });
  const destinatarios = args.destinatarios.join(",");

  try {
    await mailClient().send({
      from: FROM,
      to: args.destinatarios,
      subject: assunto,
      html,
      attachments: truckAttachment ? [truckAttachment] : undefined,
    });
    await safeLogEmail({
      tipo: "geral",
      destinatarios,
      assunto,
      enviadoPor: args.enviadoPor,
      status: "enviado",
    });
    return { ok: true };
  } catch (e) {
    const msg = sendGridErrorMessage(e);
    console.error("Erro no envio do relatório geral", msg);
    await safeLogEmail({
      tipo: "geral",
      destinatarios,
      assunto,
      enviadoPor: args.enviadoPor,
      status: "erro",
      erroMsg: msg,
    });
    return { ok: false, error: publicEmailErrorMessage(msg) };
  }
}

export async function sendRelatorioIndividual(args: {
  destinatarios: string[];
  frota: Frota;
  enviadoPor: string;
}): Promise<SendResult> {
  const assunto = `Frota ${args.frota.placa ?? args.frota.id} - relatório`;
  const truckAttachment = await getTruckAttachment();
  const html = renderRelatorioIndividual(args.frota, {
    truckImageSrc: truckAttachment ? `cid:${TRUCK_CID}` : undefined,
  });
  const destinatarios = args.destinatarios.join(",");

  try {
    await mailClient().send({
      from: FROM,
      to: args.destinatarios,
      subject: assunto,
      html,
      attachments: truckAttachment ? [truckAttachment] : undefined,
    });
    await safeLogEmail({
      tipo: "individual",
      frotaId: args.frota.id,
      destinatarios,
      assunto,
      enviadoPor: args.enviadoPor,
      status: "enviado",
    });
    return { ok: true };
  } catch (e) {
    const msg = sendGridErrorMessage(e);
    console.error("Erro no envio do relatório individual", msg);
    await safeLogEmail({
      tipo: "individual",
      frotaId: args.frota.id,
      destinatarios,
      assunto,
      enviadoPor: args.enviadoPor,
      status: "erro",
      erroMsg: msg,
    });
    return { ok: false, error: publicEmailErrorMessage(msg) };
  }
}
