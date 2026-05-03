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
    sg.setApiKey(process.env.SENDGRID_API_KEY?.trim() ?? "");
    configured = true;
  }
  return sg;
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
