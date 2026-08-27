import type { PedidoPecas } from "@/lib/repos/pedidos-pecas";

const PEDIDOS_PECAS_LOGO_URL =
  process.env.PECAS_LOGO_URL?.trim() ||
  "https://nwoqastjgkgsifmxdqwp.supabase.co/storage/v1/object/public/email-assets/bemol-logo-email.png";

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function detailRow(label: string, value: string, shaded = false): string {
  const background = shaded ? "#5b626a" : "#292929";
  return `<tr>
    <td style="width:35%;padding:11px 13px;background:${background};color:#dbe4f3;font-size:14px;font-weight:700;">${escapeHtml(label)}</td>
    <td style="padding:11px 13px;background:${background};color:#e8edf5;font-size:14px;">${value}</td>
  </tr>`;
}

export function pedidoPecasSubject(pedido: PedidoPecas): string {
  return `Solicitação de orçamento | Frota ${pedido.frota_codigo} | ${pedido.codigo}`;
}

export function renderPedidoPecasEmail(pedido: PedidoPecas): string {
  const pecas = pedido.itens
    .map((item) => `${escapeHtml(item.quantidade)} - ${escapeHtml(item.descricao)}`)
    .join("<br>");

  return `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#5b5b5b;color:#e8edf5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#5b5b5b" style="border-collapse:collapse;background:#5b5b5b;">
      <tr><td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" bgcolor="#292929" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background:#292929;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:30px;">
              <img src="${PEDIDOS_PECAS_LOGO_URL}" width="140" height="76" alt="Bemol" style="display:block;width:140px;height:76px;margin:0 auto 22px;border:0;outline:none;text-decoration:none;">
              <h1 style="margin:0 0 12px;color:#c9d8ff;font-size:24px;line-height:31px;text-align:center;">Solicitação de Orçamento</h1>
              <p style="margin:0 0 14px;color:#e8edf5;font-size:14px;line-height:21px;">Prezados,</p>
              <p style="margin:0 0 22px;color:#e8edf5;font-size:14px;line-height:21px;">Solicitamos orçamento para o item abaixo:</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;border:1px solid #d7e0eb;border-radius:7px;overflow:hidden;">
                ${detailRow("Frota", escapeHtml(pedido.frota_codigo), true)}
                ${detailRow("Placa", escapeHtml(pedido.placa))}
                ${detailRow("Modelo / Marca", escapeHtml(pedido.modelo), true)}
                ${detailRow("Chassi", escapeHtml(pedido.chassi))}
                ${detailRow("Ano", escapeHtml(pedido.ano_fabricacao), true)}
                ${detailRow("Peça", pecas)}
              </table>

              <p style="margin:28px 0 0;color:#e8edf5;font-size:14px;line-height:21px;">Ficamos no aguardo da cotação.</p>
              <p style="margin:14px 0 0;color:#e8edf5;font-size:14px;line-height:20px;">Atenciosamente,<br><strong>Equipe Bemol</strong></p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
