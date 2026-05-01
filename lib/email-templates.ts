import {
  CONDICAO_LABELS,
  STATUS_OPERACIONAL_LABELS,
  condicaoFrota,
  motivosAtencao,
  statusOperacional,
} from "@/lib/frota-derived";
import type { Frota } from "@/lib/repos/frotas";
import { calcularIdade } from "@/lib/rules";

const HEADER = `
<div style="background:#0b4aa2;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
  <div style="font-size:13px;opacity:.86">Cockpit de Frotas</div>
  <div style="font-size:22px;font-weight:700;margin-top:4px;">Frotas Bemol</div>
</div>`;

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

function row(label: string, value: string | number | null | undefined): string {
  return `<tr><td style="padding:6px 12px;color:#64748b;font-size:12px;">${escapeHtml(
    label
  )}</td><td style="padding:6px 12px;font-size:13px;font-weight:500;">${display(value)}</td></tr>`;
}

function summaryPill(label: string, value: number, color: string): string {
  return `
    <td style="padding:6px;">
      <div style="border:1px solid #e2e8f0;border-left:4px solid ${color};border-radius:8px;padding:10px 12px;background:#fff;">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;">${escapeHtml(label)}</div>
        <div style="font-size:20px;font-weight:700;color:#0f172a;">${value.toLocaleString("pt-BR")}</div>
      </div>
    </td>`;
}

export function renderRelatorioGeral(frotas: Frota[], dataRef: Date): string {
  const disponiveis = frotas.filter((f) => statusOperacional(f) === "disponivel").length;
  const indisponiveis = frotas.filter((f) => statusOperacional(f) === "indisponivel").length;
  const acima7 = frotas.filter((f) => {
    const idade = calcularIdade(f.ano_fabricacao);
    return idade != null && idade >= 7;
  }).length;
  const semKm = frotas.filter((f) => f.km_atual == null).length;

  const linhas = frotas
    .map((f) => {
      const idade = calcularIdade(f.ano_fabricacao);
      const status = STATUS_OPERACIONAL_LABELS[statusOperacional(f)];
      const condicao = CONDICAO_LABELS[condicaoFrota(f)];
      const motivo = motivosAtencao(f).join("; ");

      return `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${display(f.frota_geral)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${display(f.placa)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${display(f.modelo)}</td>
      <td style="padding:8px;text-align:right;border-bottom:1px solid #e2e8f0;">${display(f.ano_fabricacao)}</td>
      <td style="padding:8px;text-align:right;border-bottom:1px solid #e2e8f0;">${display(idade)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${display(f.localizacao)}</td>
      <td style="padding:8px;text-align:right;border-bottom:1px solid #e2e8f0;">${display(
        f.km_atual?.toLocaleString("pt-BR")
      )}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${display(status)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${display(condicao)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${display(motivo)}</td>
    </tr>`;
    })
    .join("");

  return `
  <div style="font-family:Arial,sans-serif;max-width:1120px;margin:0 auto;color:#0f172a;background:#f8fafc;">
    ${HEADER}
    <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px;">
      <h2 style="margin:0 0 4px;font-size:18px;">Relatorio geral de frotas</h2>
      <div style="font-size:12px;color:#64748b;margin-bottom:16px;">Data: ${dataRef.toLocaleDateString(
        "pt-BR"
      )} &middot; ${frotas.length} frota(s)</div>
      <table style="width:100%;border-collapse:collapse;margin:0 -6px 18px;">
        <tr>
          ${summaryPill("Total", frotas.length, "#0b4aa2")}
          ${summaryPill("Disponiveis", disponiveis, "#059669")}
          ${summaryPill("Indisponiveis", indisponiveis, "#dc2626")}
          ${summaryPill("Acima de 7 anos", acima7, "#ea580c")}
          ${summaryPill("Sem KM", semKm, "#0284c7")}
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#0b4aa2;color:#fff;">
          <th style="padding:8px;text-align:left;">Frota</th>
          <th style="padding:8px;text-align:left;">Placa</th>
          <th style="padding:8px;text-align:left;">Modelo</th>
          <th style="padding:8px;text-align:right;">Ano</th>
          <th style="padding:8px;text-align:right;">Idade</th>
          <th style="padding:8px;text-align:left;">Localizacao</th>
          <th style="padding:8px;text-align:right;">KM</th>
          <th style="padding:8px;text-align:left;">Status</th>
          <th style="padding:8px;text-align:left;">Condicao</th>
          <th style="padding:8px;text-align:left;">Motivo</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
  </div>`;
}

export function renderRelatorioIndividual(frota: Frota): string {
  const idade = calcularIdade(frota.ano_fabricacao);
  const status = STATUS_OPERACIONAL_LABELS[statusOperacional(frota)];
  const condicao = CONDICAO_LABELS[condicaoFrota(frota)];
  const motivos = motivosAtencao(frota);
  const observacoes = frota.observacoes
    ? `<div style="margin-top:16px;font-size:13px;"><strong>Observacoes:</strong><br>${escapeHtml(
        frota.observacoes
      ).replace(/\n/g, "<br>")}</div>`
    : "";

  return `
  <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#0f172a;background:#f8fafc;">
    ${HEADER}
    <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px;">
      <h2 style="margin:0 0 4px;font-size:18px;">Detalhes da frota ${display(
        frota.placa ?? frota.frota_geral ?? frota.id
      )}</h2>
      <div style="font-size:12px;color:#64748b;margin-bottom:16px;">${new Date().toLocaleDateString(
        "pt-BR"
      )}</div>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:6px;overflow:hidden;">
        <tbody>
          ${row("Frota geral", frota.frota_geral)}
          ${row("Placa", frota.placa)}
          ${row("Modelo / Marca", frota.modelo)}
          ${row("Chassi", frota.chassi)}
          ${row("Ano de fabricacao", frota.ano_fabricacao)}
          ${row("Idade", idade != null ? `${idade} ano(s)` : null)}
          ${row("Localizacao", frota.localizacao)}
          ${row("Km atual", frota.km_atual?.toLocaleString("pt-BR"))}
          ${row("Status operacional", status)}
          ${row("Condicao", condicao)}
          ${row("Motivo da atencao", motivos.join("; "))}
        </tbody>
      </table>
      ${observacoes}
    </div>
  </div>`;
}
