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
import type { Kpis } from "@/lib/repos/frotas";
import type { PlanejamentoOverview } from "@/lib/repos/planejamento";
import { formatReportDate } from "@/lib/report-date";
import { calcularIdade } from "@/lib/rules";

type ReportOptions = {
  logoImageSrc?: string;
  cdNome?: string;
};

type ChartPoint = { status: string; total: number };
type YearPoint = { ano: number | null; total: number };

export type DashboardReportInput = {
  k: Kpis;
  operational: ChartPoint[];
  conditions: ChartPoint[];
  byYear: YearPoint[];
  plan: PlanejamentoOverview | null;
};

const BLUE = "#0b3f8e";
const BLUE_2 = "#0b64c0";
const INK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#dbe7f5";
const SURFACE = "#f6f9fd";
const DASHBOARD_CHART_COLORS: Record<string, string> = {
  disponivel: "#22a879",
  manutencao: "#f59e0b",
  indisponivel: "#ef4444",
  baixado: "#64748b",
  normal: "#22a879",
  atencao: "#f97316",
  critico: "#ef4444",
};

const DASHBOARD_CHART_LABELS: Record<string, string> = {
  disponivel: "Disponível",
  manutencao: "Em manutenção",
  indisponivel: "Indisponível",
  baixado: "Baixado",
  normal: "Normal",
  atencao: "Atenção",
  critico: "Crítico",
};

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

function dateDisplay(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function maintenanceType(value: string | null | undefined): string {
  if (!value) return "Não informado";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function row(label: string, value: string | number | null | undefined): string {
  return `<tr><td style="padding:8px 12px;color:${MUTED};font-size:12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(
    label
  )}</td><td style="padding:8px 12px;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0;">${display(
    value
  )}</td></tr>`;
}

function emailLogo(src: string | undefined, width: number): string {
  if (!src) {
    return `
      <div style="width:${width}px;height:${Math.round(
        width * 0.42
      )}px;border-radius:10px;background:#eaf3ff;color:${BLUE};font-size:13px;font-weight:700;text-align:center;line-height:${Math.round(
        width * 0.42
      )}px;">
        MANUTENCAO CD
      </div>`;
  }

  return `<img src="${escapeHtml(
    src
  )}" width="${width}" alt="Manutencao CD" style="display:block;width:${width}px;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;">`;
}

function metricBox(label: string, value: string | number, hint: string | null, color: string): string {
  return `<td style="width:25%;padding:6px;vertical-align:top;">
    <div style="height:96px;box-sizing:border-box;border-top:3px solid ${color};border:1px solid #dbe7f5;border-radius:12px;padding:14px 14px;background:#ffffff;">
      <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">${escapeHtml(label)}</div>
      <div style="font-size:26px;line-height:34px;font-weight:800;color:${INK};margin-top:4px;">${escapeHtml(String(value))}</div>
      ${hint ? `<div style="font-size:12px;line-height:18px;color:${MUTED};">${escapeHtml(hint)}</div>` : ""}
    </div>
  </td>`;
}

function horizontalChart(title: string, data: ChartPoint[], colors: Record<string, string>, labels: Record<string, string>): string {
  const max = Math.max(1, ...data.map((item) => item.total));
  const rows = data
    .map((item) => {
      const width = Math.max(4, Math.round((item.total / max) * 100));
      const color = colors[item.status] ?? "#64748b";
      const label = labels[item.status] ?? item.status;
      return `<tr>
        <td style="width:150px;padding:7px 8px;font-size:12px;color:${MUTED};">${escapeHtml(label)}</td>
        <td style="padding:7px 8px;">
          <div style="height:12px;background:#eef4fb;border-radius:999px;overflow:hidden;">
            <div style="height:12px;width:${width}%;background:${color};border-radius:999px;"></div>
          </div>
        </td>
        <td style="width:70px;padding:7px 8px;text-align:right;font-size:13px;font-weight:800;color:${INK};">${formatNumber(item.total)}</td>
      </tr>`;
    })
    .join("");

  return `<td style="width:50%;padding:8px;vertical-align:top;">
    <div style="border:1px solid ${BORDER};border-radius:12px;background:#ffffff;padding:16px;">
      <div style="font-size:14px;font-weight:800;color:${INK};margin-bottom:8px;">${escapeHtml(title)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${rows}</table>
    </div>
  </td>`;
}

function yearGrid(data: YearPoint[]): string {
  const currentYear = new Date().getFullYear();
  return data
    .map((item) => {
      const idade = item.ano == null ? null : currentYear - item.ano;
      const color = idade == null ? "#64748b" : idade >= 10 ? "#ef4444" : idade >= 7 ? "#f97316" : "#2563eb";
      const label = item.ano == null ? "Sem ano" : String(item.ano);
      const hint = idade == null ? "Sem ano" : `${idade} ${idade === 1 ? "ano" : "anos"}`;
      return `<td style="width:12.5%;padding:6px;">
        <div style="border:1px solid ${color}33;background:${color}0f;border-radius:10px;padding:10px;">
          <div style="font-size:11px;font-weight:800;color:${color};text-transform:uppercase;">${escapeHtml(label)}</div>
          <div style="font-size:10px;color:${MUTED};text-align:right;">${escapeHtml(hint)}</div>
          <div style="font-size:22px;font-weight:800;color:${INK};margin-top:4px;">${formatNumber(item.total)}</div>
        </div>
      </td>`;
    })
    .join("");
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
  const cdBadge = options.cdNome
    ? `<div style="display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.35);border-radius:999px;padding:4px 14px;font-size:12px;font-weight:700;letter-spacing:.05em;color:#ffffff;margin-bottom:10px;text-transform:uppercase;">${escapeHtml(options.cdNome)}</div><br>`
    : "";
  return `
    <tr>
      <td style="background:${BLUE};border-radius:14px 14px 0 0;padding:0;overflow:hidden;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:26px 28px;color:#ffffff;vertical-align:middle;">
              ${cdBadge}
              <div style="font-size:27px;line-height:33px;font-weight:800;">${escapeHtml(title)}</div>
              <div style="font-size:13px;line-height:20px;color:#dbeafe;margin-top:6px;">${escapeHtml(subtitle)}</div>
            </td>
            <td align="right" style="width:280px;padding:20px 28px 18px 10px;vertical-align:middle;">
              <div style="display:inline-block;background:#1f2937;border-radius:16px;padding:10px 16px;">
                ${emailLogo(options.logoImageSrc, 220)}
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
  const frotasEmManutencao = frotas.filter((f) => statusOperacional(f) === "manutencao");

  const linhas = frotasEmManutencao
    .map((f, index) => {
      const motivo = f.manutencao_motivo?.trim() || "Motivo não informado";
      const entrada = dateDisplay(f.manutencao_iniciado_em) ?? "Não informado";
      const saida = dateDisplay(f.manutencao_prev_retorno) ?? "Sem previsão";
      const bg = index % 2 === 0 ? "#ffffff" : "#f8fafc";

      return `
        <tr style="background:${bg};">
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:middle;font-size:13px;font-weight:800;color:${INK};">${display(f.frota_geral ?? f.id)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:middle;font-size:13px;">${display(f.placa)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:middle;font-size:13px;">${display(maintenanceType(f.manutencao_tipo))}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:middle;color:${MUTED};font-size:12px;max-width:280px;">${display(motivo)}</td>
          <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #e2e8f0;vertical-align:middle;font-size:13px;">${display(entrada)}</td>
          <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #e2e8f0;vertical-align:middle;font-size:13px;">${display(saida)}</td>
        </tr>`;
    })
    .join("");
  const tabelaFrotasEmManutencao =
    linhas ||
    `<tr><td colspan="6" style="padding:14px 12px;color:${MUTED};font-size:13px;text-align:center;">Nenhuma frota em manutenção no momento.</td></tr>`;

  const tituloRelatorio = options.cdNome
    ? `Disponibilidade de frotas — ${options.cdNome}`
    : "Disponibilidade de frotas";

  return shell(`
    ${header(
      tituloRelatorio,
      `${formatReportDate(dataRef)} · ${formatNumber(total)} frota(s) em operação`,
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
            ${summaryCell("Cadastro incompleto", formatNumber(cadastro), "#334155")}
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-bottom:1px solid ${BORDER};border-radius:0 0 14px 14px;padding:0 24px 24px;">
        <div style="font-size:14px;font-weight:800;color:${INK};margin:4px 0 10px;">Frotas em manutenção</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #dbe7f5;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:${BLUE};color:#ffffff;">
              <th style="padding:10px 8px;text-align:left;">Frota</th>
              <th style="padding:10px 8px;text-align:left;">Placa</th>
              <th style="padding:10px 8px;text-align:left;">Tipo</th>
              <th style="padding:10px 8px;text-align:left;">Motivo da manutenção</th>
              <th style="padding:10px 8px;text-align:center;">Entrada</th>
              <th style="padding:10px 8px;text-align:center;">Prev. saída</th>
            </tr>
          </thead>
          <tbody>${tabelaFrotasEmManutencao}</tbody>
        </table>
      </td>
    </tr>`);
}

export function renderRelatorioPainelExecutivo(
  data: DashboardReportInput,
  dataRef: Date,
  options: ReportOptions = {}
): string {
  const { k, operational, conditions, byYear, plan } = data;
  const dispPct = plan?.disp_hoje != null ? `${(plan.disp_hoje * 100).toFixed(1)}%` : `${k.disponibilidade_pct}%`;
  const metaPct = plan?.disp_meta != null ? `${(plan.disp_meta * 100).toFixed(0)}%` : "90%";
  const atingiuMeta = plan?.disp_hoje != null && plan.disp_meta != null
    ? plan.disp_hoje >= plan.disp_meta
    : k.disponibilidade_pct >= Number.parseInt(metaPct, 10);
  const criticosTotal = k.total_indisponiveis + (k.total_manutencao_atrasada ?? 0);
  const yearRows = byYear.reduce<string[][]>((rows, item, index) => {
    const rowIndex = Math.floor(index / 4);
    rows[rowIndex] ??= [];
    rows[rowIndex].push(yearGrid([item]));
    return rows;
  }, []);

  return shell(`
    ${header(
      "Operação Bemol",
      `${formatReportDate(dataRef)} · visão executiva de disponibilidade, manutenção e indicadores críticos`,
      options
    )}
    <tr>
      <td style="background:#ffffff;border:1px solid ${BORDER};border-top:0;padding:22px 24px 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;table-layout:fixed;margin-bottom:12px;">
          <tr>
            ${metricBox("Disponibilidade", dispPct, `Meta ${metaPct}`, atingiuMeta ? "#22a879" : "#f59e0b")}
            ${metricBox("Frotas ativas", formatNumber(k.total_ativos), `${formatNumber(k.total_disponiveis)} disponíveis`, "#2563eb")}
            ${metricBox("Em atenção crítica", formatNumber(criticosTotal), k.total_manutencao_atrasada > 0 ? `${formatNumber(k.total_manutencao_atrasada)} manutenções atrasadas` : "Indisponíveis + atrasos", "#ef4444")}
            ${metricBox("Meta operacional", metaPct, atingiuMeta ? "Meta atingida hoje" : "Abaixo da meta", atingiuMeta ? "#22a879" : "#f59e0b")}
          </tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;table-layout:fixed;margin-bottom:12px;">
          <tr>
            ${metricBox("Disponíveis", formatNumber(k.total_disponiveis), null, "#22a879")}
            ${metricBox("Em manutenção", formatNumber(k.total_manutencao), k.total_manutencao_atrasada > 0 ? `${formatNumber(k.total_manutencao_atrasada)} com retorno atrasado` : null, "#8b5cf6")}
            ${metricBox("Indisponíveis", formatNumber(k.total_indisponiveis), null, "#ef4444")}
            ${metricBox("Em atenção", formatNumber(k.total_atencao), null, "#f97316")}
          </tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;table-layout:fixed;margin-bottom:12px;">
          <tr>
            ${metricBox("Manutenções atrasadas", formatNumber(plan?.manut_atrasadas ?? k.total_manutencao_atrasada), null, "#f59e0b")}
            ${metricBox("Lavagem atrasada", formatNumber(plan?.lavagem_atrasada ?? k.lavagem_atrasada), null, "#f59e0b")}
            ${metricBox("Idade média", k.idade_media != null ? `${k.idade_media.toFixed(1)}a` : "—", `${formatNumber(k.total_acima_7)} acima de 7 anos`, "#94a3b8")}
            ${metricBox("KM médio", k.km_medio != null ? formatNumber(Math.round(k.km_medio)) : "—", null, "#94a3b8")}
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};padding:0 16px 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            ${horizontalChart("Status operacional", operational, DASHBOARD_CHART_COLORS, DASHBOARD_CHART_LABELS)}
            ${horizontalChart("Condição da frota", conditions, DASHBOARD_CHART_COLORS, DASHBOARD_CHART_LABELS)}
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-bottom:1px solid ${BORDER};border-radius:0 0 14px 14px;padding:8px 24px 24px;">
        <div style="border:1px solid ${BORDER};border-radius:12px;background:#ffffff;padding:16px;">
          <div style="font-size:14px;font-weight:800;color:${INK};margin-bottom:8px;">Frotas por ano de fabricação</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            ${yearRows.map((row) => `<tr>${row.join("")}</tr>`).join("")}
          </table>
        </div>
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
            <td style="width:130px;vertical-align:middle;">${emailLogo(options.logoImageSrc, 118)}</td>
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
