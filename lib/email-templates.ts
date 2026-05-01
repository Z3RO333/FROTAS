import type { Frota } from "@/lib/repos/frotas";
import { calcularIdade } from "@/lib/rules";

const HEADER = `
<div style="background:hsl(222,47%,25%);color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
  <div style="font-size:13px;opacity:.85">Sistema de Gestao de Frotas</div>
  <div style="font-size:22px;font-weight:600;margin-top:4px;">Frotas Bemol</div>
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
  return value == null || value === "" ? "—" : escapeHtml(String(value));
}

function row(label: string, value: string | number | null | undefined): string {
  return `<tr><td style="padding:6px 12px;color:#64748b;font-size:12px;">${escapeHtml(
    label
  )}</td><td style="padding:6px 12px;font-size:13px;font-weight:500;">${display(value)}</td></tr>`;
}

export function renderRelatorioGeral(frotas: Frota[], dataRef: Date): string {
  const linhas = frotas
    .map(
      (f) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${display(f.frota_geral)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${display(f.placa)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${display(f.modelo)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${display(f.localizacao)}</td>
      <td style="padding:8px;text-align:right;border-bottom:1px solid #e2e8f0;">${display(
        f.km_atual?.toLocaleString("pt-BR")
      )}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${display(f.status)}</td>
    </tr>`
    )
    .join("");

  return `
  <div style="font-family:Arial,sans-serif;max-width:880px;margin:0 auto;color:#0f172a;">
    ${HEADER}
    <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px;">
      <h2 style="margin:0 0 4px;font-size:18px;">Relatorio geral de frotas</h2>
      <div style="font-size:12px;color:#64748b;margin-bottom:16px;">Data: ${dataRef.toLocaleDateString(
        "pt-BR"
      )} · ${frotas.length} frota(s)</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:hsl(222,47%,25%);color:#fff;">
          <th style="padding:8px;text-align:left;">Frota</th>
          <th style="padding:8px;text-align:left;">Placa</th>
          <th style="padding:8px;text-align:left;">Modelo</th>
          <th style="padding:8px;text-align:left;">Localizacao</th>
          <th style="padding:8px;text-align:right;">Km</th>
          <th style="padding:8px;text-align:left;">Status</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
  </div>`;
}

export function renderRelatorioIndividual(frota: Frota): string {
  const idade = calcularIdade(frota.ano_fabricacao);
  const observacoes = frota.observacoes
    ? `<div style="margin-top:16px;font-size:13px;"><strong>Observacoes:</strong><br>${escapeHtml(
        frota.observacoes
      ).replace(/\n/g, "<br>")}</div>`
    : "";

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
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
          ${row("Status", frota.status)}
        </tbody>
      </table>
      ${observacoes}
    </div>
  </div>`;
}
