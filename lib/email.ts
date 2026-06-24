import sg from "@sendgrid/mail";
import { readFile } from "fs/promises";
import { join } from "path";
import type { AttachmentData } from "@sendgrid/helpers/classes/attachment";
import {
  renderRelatorioGeral,
  renderRelatorioIndividual,
  renderRelatorioPainelExecutivo,
  renderSocorroNotification,
  type DashboardReportInput,
  type SocorroNotificationInput,
} from "@/lib/email-templates";
import type { Frota } from "@/lib/repos/frotas";
import { logEmail } from "@/lib/repos/email-logs";
import { formatReportDate } from "@/lib/report-date";
import { getEmailFrom } from "@/lib/email-from";

const FROM = getEmailFrom();
const EMAIL_LOGO_CID = "bemol-manutencao-logo";

type SendResult = { ok: true } | { ok: false; error: string };

let configured = false;
let emailLogoAttachmentPromise: Promise<AttachmentData | null> | null = null;

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

function getEmailLogoAttachment(): Promise<AttachmentData | null> {
  if (!emailLogoAttachmentPromise) {
    emailLogoAttachmentPromise = (async () => {
      const png = await readFile(join(process.cwd(), "public", "assets", "bemol-manutencao-logo.png"));
      return {
        content: Buffer.from(png).toString("base64"),
        filename: "bemol-manutencao-logo.png",
        type: "image/png",
        disposition: "inline",
        content_id: EMAIL_LOGO_CID,
      } as unknown as AttachmentData;
    })().catch((error) => {
      console.error("Falha ao preparar logo de manutencao para o e-mail", error);
      return null;
    });
  }

  return emailLogoAttachmentPromise;
}

export async function sendRelatorioGeral(args: {
  destinatarios: string[];
  frotas: Frota[];
  enviadoPor: string;
  cdNome?: string;
}): Promise<SendResult> {
  const sentAt = new Date();
  const cdLabel = args.cdNome ? ` — ${args.cdNome}` : "";
  const assunto = `Disponibilidade de frotas${cdLabel} - ${formatReportDate(sentAt)}`;
  const emailLogoAttachment = await getEmailLogoAttachment();
  const html = renderRelatorioGeral(args.frotas, sentAt, {
    logoImageSrc: emailLogoAttachment ? `cid:${EMAIL_LOGO_CID}` : undefined,
    cdNome: args.cdNome,
  });
  const destinatarios = args.destinatarios.join(",");

  try {
    await mailClient().send({
      from: FROM,
      to: args.destinatarios,
      subject: assunto,
      html,
      attachments: emailLogoAttachment ? [emailLogoAttachment] : undefined,
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

export async function sendRelatorioPainelExecutivo(args: {
  destinatarios: string[];
  painel: DashboardReportInput;
  enviadoPor: string;
}): Promise<SendResult> {
  const sentAt = new Date();
  const assunto = `Resumo de Frotas - ${formatReportDate(sentAt)}`;
  const emailLogoAttachment = await getEmailLogoAttachment();
  const html = renderRelatorioPainelExecutivo(args.painel, sentAt, {
    logoImageSrc: emailLogoAttachment ? `cid:${EMAIL_LOGO_CID}` : undefined,
  });
  const destinatarios = args.destinatarios.join(",");

  try {
    await mailClient().send({
      from: FROM,
      to: args.destinatarios,
      subject: assunto,
      html,
      attachments: emailLogoAttachment ? [emailLogoAttachment] : undefined,
    });
    await safeLogEmail({
      tipo: "painel_executivo",
      destinatarios,
      assunto,
      enviadoPor: args.enviadoPor,
      status: "enviado",
    });
    return { ok: true };
  } catch (e) {
    const msg = sendGridErrorMessage(e);
    console.error("Erro no envio do painel executivo", msg);
    await safeLogEmail({
      tipo: "painel_executivo",
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
  const emailLogoAttachment = await getEmailLogoAttachment();
  const html = renderRelatorioIndividual(args.frota, {
    logoImageSrc: emailLogoAttachment ? `cid:${EMAIL_LOGO_CID}` : undefined,
  });
  const destinatarios = args.destinatarios.join(",");

  try {
    await mailClient().send({
      from: FROM,
      to: args.destinatarios,
      subject: assunto,
      html,
      attachments: emailLogoAttachment ? [emailLogoAttachment] : undefined,
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

function parseEmailList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

const SOCORRO_AREA_EMAIL_MAP: Record<string, string> = {
  Exposicao: "SOCORRO_AREA_EMAIL_EXPOSICAO",
  Market: "SOCORRO_AREA_EMAIL_MARKET",
  "E-commerce": "SOCORRO_AREA_EMAIL_ECOMMERCE",
  Farma: "SOCORRO_AREA_EMAIL_FARMA",
  Operacao: "SOCORRO_AREA_EMAIL_OPERACAO",
  Outros: "SOCORRO_AREA_EMAIL_OUTROS",
};

export async function sendSocorroNotification(input: SocorroNotificationInput): Promise<void> {
  const manutencaoEmails = parseEmailList(process.env.FROTAS_MANUTENCAO_EMAILS);
  const monitoramento = "monitoramentofrotas@bemol.com.br";

  const areaEnvVar = SOCORRO_AREA_EMAIL_MAP[input.setor];
  const areaEmails = areaEnvVar ? parseEmailList(process.env[areaEnvVar]) : [];

  const destinatarios = [...new Set([...manutencaoEmails, monitoramento, ...areaEmails])].filter(Boolean);
  if (destinatarios.length === 0) {
    console.warn("[socorro] nenhum destinatario configurado para notificacao");
    return;
  }

  const urgente = input.precisaGuincho ? "[URGENTE] " : "";
  const guincho = input.precisaGuincho ? "Sim" : "Nao";
  const assunto = `${urgente}[SOCORRO FROTA] Nova solicitacao - Area: ${input.setor} - Guincho: ${guincho}`;

  const html = renderSocorroNotification(input);

  try {
    await mailClient().send({
      from: FROM,
      to: destinatarios,
      subject: assunto,
      html,
    });
    await safeLogEmail({
      tipo: "socorro",
      destinatarios: destinatarios.join(","),
      assunto,
      enviadoPor: input.solicitanteEmail,
      status: "enviado",
    });
  } catch (e) {
    const msg = sendGridErrorMessage(e);
    console.error("[socorro] erro ao enviar notificacao", msg);
    await safeLogEmail({
      tipo: "socorro",
      destinatarios: destinatarios.join(","),
      assunto,
      enviadoPor: input.solicitanteEmail,
      status: "erro",
      erroMsg: msg,
    });
    throw new Error(msg);
  }
}
