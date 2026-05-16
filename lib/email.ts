import sg from "@sendgrid/mail";
import { readFile } from "fs/promises";
import { join } from "path";
import type { AttachmentData } from "@sendgrid/helpers/classes/attachment";
import { renderRelatorioGeral, renderRelatorioIndividual } from "@/lib/email-templates";
import type { Frota } from "@/lib/repos/frotas";
import { logEmail } from "@/lib/repos/email-logs";
import { formatReportDate } from "@/lib/report-date";

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
    truckAttachmentPromise = (async () => {
      const svg = await readFile(join(process.cwd(), "public", "assets", "caminhao-bemol.svg"));
      const { Resvg } = await import("@resvg/resvg-js");
      const png = new Resvg(svg, {
        fitTo: { mode: "width", value: 640 },
        font: { loadSystemFonts: true, defaultFontFamily: "Arial" },
      })
        .render()
        .asPng();
      return {
        content: Buffer.from(png).toString("base64"),
        filename: "caminhao-bemol.png",
        type: "image/png",
        disposition: "inline",
        content_id: TRUCK_CID,
      } as unknown as AttachmentData;
    })().catch((error) => {
      console.error("Falha ao preparar imagem do caminhão para o e-mail", error);
      return null;
    });
  }

  return truckAttachmentPromise;
}

export async function sendRelatorioGeral(args: {
  destinatarios: string[];
  frotas: Frota[];
  enviadoPor: string;
}): Promise<SendResult> {
  const sentAt = new Date();
  const assunto = `Relatório de frotas - ${formatReportDate(sentAt)}`;
  const truckAttachment = await getTruckAttachment();
  const html = renderRelatorioGeral(args.frotas, sentAt, {
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

export async function sendRelatorioDiarioIa(args: {
  destinatarios: string[];
  html: string;
  assunto: string;
  enviadoPor?: string;
}): Promise<SendResult> {
  const destinatarios = args.destinatarios.join(",");
  const enviadoPor = args.enviadoPor ?? "sistema";

  try {
    await mailClient().send({
      from: FROM,
      to: args.destinatarios,
      subject: args.assunto,
      html: args.html,
    });
    await safeLogEmail({
      tipo: "diario_ia",
      destinatarios,
      assunto: args.assunto,
      enviadoPor,
      status: "enviado",
    });
    return { ok: true };
  } catch (e) {
    const msg = sendGridErrorMessage(e);
    console.error("Erro no envio do relatório diário IA", msg);
    await safeLogEmail({
      tipo: "diario_ia",
      destinatarios,
      assunto: args.assunto,
      enviadoPor,
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
