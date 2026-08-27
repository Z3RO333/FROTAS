import "server-only";
import { pedidoPecasSubject, renderPedidoPecasEmail } from "@/lib/pedidos-pecas-email";
import {
  concluirEnvioPedidoPecas,
  getPedidoPecas,
  iniciarEnvioPedidoPecas,
  recalcularStatusPedidoPecas,
  type PedidoPecasStatus,
} from "@/lib/repos/pedidos-pecas";
import { getSgMail } from "@/lib/sendgrid";
import { logEmail } from "@/lib/repos/email-logs";

export const PEDIDOS_PECAS_FROM = {
  email: process.env.PECAS_FROM_EMAIL?.trim() || "manutencaocd_orcamentos@bemol.com.br",
  name: process.env.PECAS_FROM_NAME?.trim() || "Manutenção CD - Orçamentos",
};

export const PEDIDOS_PECAS_CC =
  process.env.PECAS_CC_EMAIL?.trim() || "manutencaocd_orcamentos@bemol.com.br";

type EnvioResultado = {
  envioId: number;
  fornecedor: string;
  email: string;
  enviado: boolean;
  erro?: string;
};

function sendGridMessage(error: unknown): string {
  const responseErrors = (error as { response?: { body?: { errors?: Array<{ message?: string }> } } })
    ?.response?.body?.errors;
  const details = responseErrors?.map((item) => item.message).filter(Boolean).join("; ");
  if (details) return details;
  return error instanceof Error ? error.message : String(error);
}

function messageId(headers: Record<string, string | string[] | undefined> | undefined): string | null {
  const raw = headers?.["x-message-id"] ?? headers?.["X-Message-Id"];
  return Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
}

export async function enviarCotacoesPedidoPecas(
  pedidoId: number,
  enviadoPor: string
): Promise<{ status: PedidoPecasStatus; resultados: EnvioResultado[] }> {
  const pedido = await getPedidoPecas(pedidoId);
  if (!pedido) throw new Error("Pedido de peças não encontrado.");

  const pendentes = pedido.envios.filter((envio) => envio.status !== "ENVIADO");
  if (pendentes.length === 0) return { status: pedido.status, resultados: [] };

  const sgMail = await getSgMail();
  const assunto = pedidoPecasSubject(pedido);
  const html = renderPedidoPecasEmail(pedido);
  const resultados: EnvioResultado[] = [];

  // Um envio por fornecedor evita expor os concorrentes no cabeçalho do e-mail.
  for (const envio of pendentes) {
    try {
      await iniciarEnvioPedidoPecas(pedido.id, envio.id);
      const [response] = await sgMail.send({
        from: PEDIDOS_PECAS_FROM,
        replyTo: PEDIDOS_PECAS_FROM.email,
        to: envio.fornecedor_email,
        cc: envio.copia_email,
        subject: assunto,
        html,
      });
      const id = messageId(response.headers as Record<string, string | string[] | undefined>);
      await concluirEnvioPedidoPecas(envio.id, { ok: true, messageId: id });
      await logEmail({
        tipo: "pedido_pecas",
        frotaId: pedido.frota_id,
        destinatarios: `${envio.fornecedor_email},${envio.copia_email}`,
        assunto,
        enviadoPor,
        status: "enviado",
        resumo: `${pedido.codigo} - ${pedido.itens.length} item(ns) - ${envio.fornecedor_nome}`,
        conteudoHtml: html,
      });
      resultados.push({
        envioId: envio.id,
        fornecedor: envio.fornecedor_nome,
        email: envio.fornecedor_email,
        enviado: true,
      });
    } catch (error) {
      const mensagem = sendGridMessage(error);
      await concluirEnvioPedidoPecas(envio.id, { ok: false, error: mensagem }).catch((dbError) => {
        console.error("[pedidos-pecas] falha ao registrar erro de envio", dbError);
      });
      await logEmail({
        tipo: "pedido_pecas",
        frotaId: pedido.frota_id,
        destinatarios: `${envio.fornecedor_email},${envio.copia_email}`,
        assunto,
        enviadoPor,
        status: "erro",
        erroMsg: mensagem,
        resumo: `${pedido.codigo} - ${envio.fornecedor_nome}`,
        conteudoHtml: html,
      }).catch((logError) => console.error("[pedidos-pecas] falha ao registrar log", logError));
      resultados.push({
        envioId: envio.id,
        fornecedor: envio.fornecedor_nome,
        email: envio.fornecedor_email,
        enviado: false,
        erro: mensagem,
      });
    }
  }

  const status = await recalcularStatusPedidoPecas(pedido.id);
  return { status, resultados };
}
