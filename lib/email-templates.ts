import {
  CONDICAO_LABELS,
  STATUS_OPERACIONAL_LABELS,
  cadastroIncompleto,
  condicaoFrota,
  motivosAtencao,
  statusOperacional,
  type CondicaoFrota,
  type StatusOperacional,
} from "@/lib/frota-derived";
import type { Frota } from "@/lib/repos/frotas";
import { formatReportDate } from "@/lib/report-date";
import { calcularIdade } from "@/lib/rules";

type ReportOptions = {
  truckImageSrc?: string;
};

const BLUE = "#0b3f8e";
const BLUE_2 = "#0b64c0";
const INK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#dbe7f5";
const SURFACE = "#f6f9fd";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function display(value: string | number | null | undefined): string {
  return value == null || value === "" ? "&mdash;" : escapeHtml(String(value));
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function percent(value: number, total: number): string {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : "0%";
}

function row(label: string, value: string | number | null | undefined): string {
  return `<tr><td style="padding:8px 12px;color:${MUTED};font-size:12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(
    label
  )}</td><td style="padding:8px 12px;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0;">${display(
    value
  )}</td></tr>`;
}

function truckImage(src: string | undefined, width: number): string {
  if (!src) {
    return `
      <div style="width:${width}px;height:${Math.round(
        width * 0.42
      )}px;border-radius:10px;background:#eaf3ff;color:${BLUE};font-size:13px;font-weight:700;text-align:center;line-height:${Math.round(
        width * 0.42
      )}px;">
        BEMOL
      </div>`;
  }

  return `<img src="${escapeHtml(
    src
  )}" width="${width}" alt="Caminhão Bemol" style="display:block;width:${width}px;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;">`;
}

function statusTone(status: StatusOperacional): { bg: string; color: string; border: string } {
  if (status === "disponivel") return { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
  if (status === "manutencao") return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
  if (status === "indisponivel") return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
  return { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" };
}

function conditionTone(condicao: CondicaoFrota): { bg: string; color: string; border: string } {
  if (condicao === "normal") return { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
  if (condicao === "atencao") return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
  return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
}

function badge(label: string, tone: { bg: string; color: string; border: string }): string {
  return `<span style="display:inline-block;border:1px solid ${tone.border};border-radius:999px;background:${tone.bg};color:${tone.color};padding:4px 9px;font-size:11px;font-weight:700;white-space:nowrap;">${escapeHtml(
    label
  )}</span>`;
}

function summaryCell(label: string, value: string, color: string, note?: string): string {
  return `
    <td style="padding:6px;width:25%;vertical-align:top;">
      <div style="border:1px solid ${BORDER};border-left:4px solid ${color};border-radius:10px;padding:12px 13px;background:#ffffff;">
        <div style="font-size:10px;letter-spacing:.04em;color:${MUTED};text-transform:uppercase;">${escapeHtml(
          label
        )}</div>
        <div style="font-size:23px;line-height:28px;font-weight:800;color:${INK};margin-top:2px;">${escapeHtml(
          value
        )}</div>
        ${note ? `<div style="font-size:11px;color:${MUTED};margin-top:2px;">${escapeHtml(note)}</div>` : ""}
      </div>
    </td>`;
}

function shell(content: string): string {
  return `
  <div style="margin:0;padding:0;background:${SURFACE};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:${SURFACE};">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="1120" cellspacing="0" cellpadding="0" style="width:1120px;max-width:1120px;border-collapse:collapse;font-family:Arial,sans-serif;color:${INK};">
            ${content}
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

function header(title: string, subtitle: string, options: ReportOptions): string {
  return `
    <tr>
      <td style="background:${BLUE};border-radius:14px 14px 0 0;padding:0;overflow:hidden;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:26px 28px;color:#ffffff;vertical-align:middle;">
              <div style="font-size:27px;line-height:33px;font-weight:800;">${escapeHtml(title)}</div>
              <div style="font-size:13px;line-height:20px;color:#dbeafe;margin-top:6px;">${escapeHtml(subtitle)}</div>
            </td>
            <td align="right" style="width:280px;padding:20px 28px 18px 10px;vertical-align:middle;">
              <div style="display:inline-block;background:#ffffff;border-radius:16px;padding:10px 16px;">
                ${truckImage(options.truckImageSrc, 220)}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function renderRelatorioGeral(frotas: Frota[], dataRef: Date, options: ReportOptions = {}): string {
  const total = frotas.length;
  const disponiveis = frotas.filter((f) => statusOperacional(f) === "disponivel").length;
  const indisponiveis = frotas.filter((f) => statusOperacional(f) === "indisponivel").length;
  const manutencao = frotas.filter((f) => statusOperacional(f) === "manutencao").length;
  const atencao = frotas.filter((f) => condicaoFrota(f) === "atencao").length;
  const criticos = frotas.filter((f) => condicaoFrota(f) === "critico").length;
  const acima7 = frotas.filter((f) => {
    const idade = calcularIdade(f.ano_fabricacao);
    return idade != null && idade >= 7;
  }).length;
  const cadastro = frotas.filter(cadastroIncompleto).length;
  const atencaoTotal = atencao + criticos;

  const linhas = frotas
    .map((f, index) => {
      const idade = calcularIdade(f.ano_fabricacao);
      const status = statusOperacional(f);
      const condicao = condicaoFrota(f);
      const motivo = motivosAtencao(f).join("; ") || "Sem alertas automáticos";
      const bg = index % 2 === 0 ? "#ffffff" : "#f8fafc";

      return `
        <tr style="background:${bg};">
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;vertical-align:middle;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr>
                <td style="width:48px;vertical-align:middle;">${truckImage(options.truckImageSrc, 42)}</td>
                <td style="vertical-align:middle;">
                  <div style="font-size:13px;font-weight:800;color:${INK};">${display(
                    f.frota_geral ?? f.id
                  )}</div>
                  <div style="font-size:11px;color:${MUTED};margin-top:2px;">Placa ${display(f.placa)}</div>
                </td>
              </tr>
            </table>
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;vertical-align:middle;">${display(
            f.modelo
          )}</td>
          <td style="padding:10px 8px;text-align:right;border-bottom:1px solid #e2e8f0;vertical-align:middle;">${display(
            f.ano_fabricacao
          )}<div style="font-size:11px;color:${MUTED};">${idade != null ? `${idade} ano(s)` : "&mdash;"}</div></td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;vertical-align:middle;">${display(
            f.localizacao
          )}</td>
          <td style="padding:10px 8px;text-align:right;border-bottom:1px solid #e2e8f0;vertical-align:middle;">${display(
            f.km_atual?.toLocaleString("pt-BR")
          )}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;vertical-align:middle;">${badge(
            STATUS_OPERACIONAL_LABELS[status],
            statusTone(status)
          )}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;vertical-align:middle;">${badge(
            CONDICAO_LABELS[condicao],
            conditionTone(condicao)
          )}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;vertical-align:middle;color:${MUTED};font-size:12px;">${display(
            motivo
          )}</td>
        </tr>`;
    })
    .join("");

  return shell(`
    ${header(
      "Relatório de frotas",
      `${formatReportDate(dataRef)} - ${formatNumber(total)} frota(s) em operação`,
      options
    )}
    <tr>
      <td style="background:#ffffff;border:1px solid ${BORDER};border-top:0;padding:22px 24px 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:14px;">
          <tr>
            <td style="background:#f8fbff;border:1px solid ${BORDER};border-radius:12px;padding:16px 18px;">
              <div style="font-size:12px;font-weight:700;letter-spacing:.04em;color:${BLUE};text-transform:uppercase;">Resumo operacional</div>
              <div style="font-size:30px;line-height:38px;font-weight:800;color:${INK};margin-top:4px;">${formatNumber(
                disponiveis
              )} de ${formatNumber(total)} frotas disponíveis</div>
              <div style="font-size:13px;color:${MUTED};line-height:20px;">${formatNumber(
                atencaoTotal
              )} frota(s) exigem atenção operacional por idade, status base ou cadastro incompleto.</div>
            </td>
            <td style="width:180px;padding-left:14px;">
              <div style="background:${BLUE_2};border-radius:12px;padding:16px 18px;color:#ffffff;text-align:center;">
                <div style="font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#dbeafe;">Disponibilidade</div>
                <div style="font-size:34px;line-height:40px;font-weight:800;margin-top:2px;">${percent(
                  disponiveis,
                  total
                )}</div>
              </div>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 -6px 18px;">
          <tr>
            ${summaryCell("Total", formatNumber(total), BLUE)}
            ${summaryCell("Disponíveis", formatNumber(disponiveis), "#059669", percent(disponiveis, total))}
            ${summaryCell("Indisponíveis", formatNumber(indisponiveis), "#dc2626")}
            ${summaryCell("Manutenção", formatNumber(manutencao), "#ea580c")}
          </tr>
          <tr>
            ${summaryCell("Acima de 7 anos", formatNumber(acima7), "#f97316")}
            ${summaryCell("Em atenção", formatNumber(atencao), "#f59e0b")}
            ${summaryCell("Críticas", formatNumber(criticos), "#ef4444")}
            ${summaryCell("Cadastro incompleto", formatNumber(cadastro), "#334155")}
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-bottom:1px solid ${BORDER};border-radius:0 0 14px 14px;padding:0 24px 24px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #dbe7f5;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:${BLUE};color:#ffffff;">
              <th style="padding:10px 8px;text-align:left;">Frota</th>
              <th style="padding:10px 8px;text-align:left;">Modelo</th>
              <th style="padding:10px 8px;text-align:right;">Ano</th>
              <th style="padding:10px 8px;text-align:left;">Localização</th>
              <th style="padding:10px 8px;text-align:right;">KM</th>
              <th style="padding:10px 8px;text-align:left;">Status</th>
              <th style="padding:10px 8px;text-align:left;">Condição</th>
              <th style="padding:10px 8px;text-align:left;">Motivo</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </td>
    </tr>`);
}

export function renderRelatorioIndividual(frota: Frota, options: ReportOptions = {}): string {
  const idade = calcularIdade(frota.ano_fabricacao);
  const status = statusOperacional(frota);
  const condicao = condicaoFrota(frota);
  const motivos = motivosAtencao(frota);
  const observacoes = frota.observacoes
    ? `<div style="margin-top:16px;font-size:13px;line-height:19px;color:${INK};"><strong>Observações:</strong><br>${escapeHtml(
        frota.observacoes
      ).replace(/\n/g, "<br>")}</div>`
    : "";

  return shell(`
    ${header(
      `Relatório da frota ${String(frota.placa ?? frota.frota_geral ?? frota.id)}`,
      `${formatReportDate(new Date())} - acompanhamento individual`,
      options
    )}
    <tr>
      <td style="background:#ffffff;border:1px solid ${BORDER};border-top:0;border-radius:0 0 14px 14px;padding:24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:18px;">
          <tr>
            <td style="width:130px;vertical-align:middle;">${truckImage(options.truckImageSrc, 118)}</td>
            <td style="vertical-align:middle;">
              <div style="font-size:12px;font-weight:700;letter-spacing:.04em;color:${BLUE};text-transform:uppercase;">Detalhe operacional</div>
              <div style="font-size:24px;line-height:30px;font-weight:800;color:${INK};margin-top:4px;">${display(
                frota.frota_geral ?? frota.id
              )}</div>
              <div style="margin-top:8px;">
                ${badge(STATUS_OPERACIONAL_LABELS[status], statusTone(status))}
                ${badge(CONDICAO_LABELS[condicao], conditionTone(condicao))}
              </div>
            </td>
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
          <tbody>
            ${row("Frota geral", frota.frota_geral)}
            ${row("Placa", frota.placa)}
            ${row("Modelo / Marca", frota.modelo)}
            ${row("Chassi", frota.chassi)}
            ${row("Ano de fabricação", frota.ano_fabricacao)}
            ${row("Idade", idade != null ? `${idade} ano(s)` : null)}
            ${row("Localização", frota.localizacao)}
            ${row("Km atual", frota.km_atual?.toLocaleString("pt-BR"))}
            ${row("Status operacional", STATUS_OPERACIONAL_LABELS[status])}
            ${row("Condição", CONDICAO_LABELS[condicao])}
            ${row("Motivo da atenção", motivos.join("; ") || "Sem alertas automáticos")}
          </tbody>
        </table>
        ${observacoes}
      </td>
    </tr>`);
}
