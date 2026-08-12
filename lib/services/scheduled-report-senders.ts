import {
  getDisponibilidadeResumo,
  getPontosAtencao,
  listFrotasEmManutencao,
  asCdResumo,
  resumoTexto,
} from "@/lib/repos/disponibilidade";
import { renderDisponibilidadeEmail } from "@/lib/email-templates";
import { EMAIL_LOGO_URL } from "@/lib/email-constants";
import { getLavagem, getManutencao, getParadas } from "@/lib/repos/planejamento";
import { getCustosPorPeriodo } from "@/lib/repos/custos";
import { listAlertasAbertos } from "@/lib/repos/alertas";
import { listTacografoPorFrota } from "@/lib/repos/tacografo";
import { getRelatorioKpis, getRankingFrotas } from "@/lib/repos/relatorios";
import { listAnalisesDia } from "@/lib/repos/analises-ia";
import { getAppUrl } from "@/lib/app-url";

export async function getSgMail() {
  const sgMail = await import("@sendgrid/mail");
  const key = process.env.SENDGRID_API_KEY?.trim();
  if (!key) throw new Error("SENDGRID_API_KEY não configurada.");
  sgMail.default.setApiKey(key);
  return sgMail.default;
}

function esc(value: string | number | null | undefined): string {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escInternal(s: string | null | undefined): string {
  return (s ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus",
  }).format(date);
}

export async function buildDisponibilidadeEmail(cdNome: string, generatedAt: Date): Promise<{ html: string; resumo: string }> {
  const [resumoRaw, manutencoes, pontos] = await Promise.all([
    getDisponibilidadeResumo(cdNome),
    listFrotasEmManutencao(cdNome, 80),
    getPontosAtencao(30, cdNome),
  ]);
  const resumo = asCdResumo(resumoRaw, cdNome);
  const resumoCurto = resumoTexto(resumo);

  const html = renderDisponibilidadeEmail(
    { resumo, manutencoes, pontos },
    generatedAt,
    { logoImageSrc: EMAIL_LOGO_URL, cdNome }
  );

  return { html, resumo: resumoCurto };
}

type ReportRow = Record<string, string | number | null | undefined>;

export function buildTable(title: string, rows: ReportRow[], generatedAt: Date): { html: string; resumo: string } {
  const visibleRows = rows.slice(0, 100);
  const columns = visibleRows.length > 0 ? Object.keys(visibleRows[0]) : [];
  const table = visibleRows.length === 0
    ? "<p>Nenhum registro encontrado para este relatório.</p>"
    : `<table style="width:100%;border-collapse:collapse;font:12px Arial,sans-serif">
        <thead><tr>${columns.map((column) => `<th style="padding:8px;text-align:left;background:#e2e8f0;border:1px solid #cbd5e1">${esc(column)}</th>`).join("")}</tr></thead>
        <tbody>${visibleRows.map((row) => `<tr>${columns.map((column) => `<td style="padding:8px;border:1px solid #e2e8f0">${esc(row[column])}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`;

  return {
    resumo: `${rows.length} registro(s) encontrado(s).`,
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head>
      <body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif">
        <main style="max-width:960px;margin:24px auto;padding:24px;background:#fff;border:1px solid #dbe7f5;border-radius:14px">
          <h1 style="font-size:22px;color:#0b3f8e">${esc(title)}</h1>
          <p style="color:#64748b">Gerado em ${esc(formatDateTime(generatedAt))}. Total: ${rows.length} registro(s).</p>
          ${table}
          ${rows.length > visibleRows.length ? `<p style="color:#64748b">Exibindo os primeiros ${visibleRows.length} registros.</p>` : ""}
        </main>
      </body></html>`,
  };
}

export async function buildOperationalEmail(tipo: string, generatedAt: Date): Promise<{ html: string; resumo: string }> {
  if (tipo === "PREVENTIVAS_ATRASO") {
    const rows = (await getManutencao()).filter((row) => row.status !== "NO_PRAZO").map((row) => ({
      Frota: row.frota_numero ?? row.equipamento,
      Placa: row.placa,
      Serviço: row.tipo_servico,
      Status: row.status,
      "Última realização": row.data_realizada,
    }));
    return buildTable("Preventivas em atraso", rows, generatedAt);
  }
  if (tipo === "LAVAGEM_PENDENTE") {
    const rows = (await getLavagem()).filter((row) => (row.atraso_dias ?? 0) > 0).map((row) => ({
      Frota: row.frota_numero ?? row.equipamento,
      Placa: row.placa,
      Setor: row.setor,
      "Dias em atraso": row.atraso_dias,
      Status: row.status,
    }));
    return buildTable("Lavagens pendentes", rows, generatedAt);
  }
  if (tipo === "TACOGRAFO_VENCIDO") {
    const rows = (await listTacografoPorFrota())
      .filter((row) => row.status !== "EM_DIA")
      .map((row) => ({
        Frota: row.frota_geral,
        Placa: row.placa,
        Local: row.localizacao,
        Status: row.status,
        Vencimento: row.data_proxima,
        "Dias para vencer": row.dias_para_vencer,
      }));
    return buildTable("Tacógrafos pendentes", rows, generatedAt);
  }
  if (tipo === "FROTAS_PARADAS") {
    const rows = (await getParadas()).map((row) => ({
      Frota: row.frota_numero,
      Placa: row.placa,
      Motivo: row.servicos ?? row.descricao_original,
      Oficina: row.oficina,
      "Previsão de saída": row.prev_saida,
      Criticidade: row.ia_criticidade,
    }));
    return buildTable("Frotas paradas", rows, generatedAt);
  }
  if (tipo === "CUSTOS") {
    const rows = (await getCustosPorPeriodo(12)).map((row) => ({
      Período: row.data_periodo,
      Ordens: row.qtd_ordens,
      "Valor total": row.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    }));
    return buildTable("Custos de manutenção", rows, generatedAt);
  }
  if (tipo === "ALERTAS") {
    const rows = (await listAlertasAbertos(100)).map((row) => ({
      Frota: row.frota_geral ?? row.frota_id,
      Placa: row.placa,
      Tipo: row.tipo,
      Título: row.titulo,
      Descrição: row.descricao,
      Criado: row.criado_em,
    }));
    return buildTable("Alertas operacionais", rows, generatedAt);
  }
  throw new Error(`Tipo de agenda não suportado: ${tipo}`);
}

export async function buildRelatorioDiarioIaEmail(hoje: string) {
  const [kpis, alertas, rankingFrotas, analises] = await Promise.all([
    getRelatorioKpis(hoje),
    listAlertasAbertos(10),
    getRankingFrotas(hoje, 5),
    listAnalisesDia(hoje),
  ]);

  const criticos = analises.filter((a) =>
    ["CRITICO", "BLOQUEIO_SUGERIDO"].includes(a.criticidade_revisada ?? a.criticidade)
  );

  const appUrl = getAppUrl();

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
body { font-family: Arial, sans-serif; color: #1e293b; background: #f8fafc; margin: 0; padding: 0; }
.container { max-width: 600px; margin: 0 auto; background: #fff; padding: 24px; }
h1 { color: #1d4ed8; font-size: 20px; }
h2 { font-size: 15px; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
.kpi-grid { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
.kpi { background: #f1f5f9; border-radius: 8px; padding: 12px 16px; min-width: 100px; }
.kpi-value { font-size: 24px; font-weight: bold; }
.kpi-label { font-size: 12px; color: #64748b; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.badge-critico { background: #fee2e2; color: #991b1b; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; padding: 8px; background: #f1f5f9; }
td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
.footer { margin-top: 32px; font-size: 12px; color: #94a3b8; }
</style></head>
<body><div class="container">
  <h1>Frotas Bemol — Relatório IA ${hoje}</h1>

  <h2>Resumo do dia</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-value">${kpis.total_checklists}</div><div class="kpi-label">Checklists</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#059669">${kpis.ok}</div><div class="kpi-label">OK</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#d97706">${kpis.atencao}</div><div class="kpi-label">Atenção</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#dc2626">${kpis.critico}</div><div class="kpi-label">Crítico</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#ea580c">${kpis.manutencao}</div><div class="kpi-label">Manutenção</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#b91c1c">${kpis.bloqueio_sugerido}</div><div class="kpi-label">Bloqueio</div></div>
  </div>

  ${criticos.length > 0 ? `
  <h2>Problemas críticos (${criticos.length})</h2>
  <table><tr><th>Frota</th><th>Criticidade</th><th>Resumo</th><th>Ação</th></tr>
  ${criticos.map((a) => `
  <tr>
    <td>${a.frota_id}</td>
    <td><span class="badge badge-critico">${escInternal((a.criticidade_revisada ?? a.criticidade).replace("_", " "))}</span></td>
    <td>${escInternal(a.resumo_ia)}</td>
    <td>${escInternal(a.acao_recomendada)}</td>
  </tr>`).join("")}
  </table>` : "<p>Nenhum problema crítico hoje.</p>"}

  ${rankingFrotas.length > 0 ? `
  <h2>Frotas com mais problemas</h2>
  <table><tr><th>Frota</th><th>Placa</th><th>Problemas</th></tr>
  ${rankingFrotas.map((f) => `<tr><td>${escInternal(f.frota_geral) !== "—" ? escInternal(f.frota_geral) : f.frota_id}</td><td>${escInternal(f.placa)}</td><td>${f.total_problemas}</td></tr>`).join("")}
  </table>` : ""}

  ${alertas.length > 0 ? `
  <h2>Alertas abertos (${alertas.length})</h2>
  <table><tr><th>Tipo</th><th>Frota</th><th>Descrição</th></tr>
  ${alertas.map((a) => `<tr><td>${escInternal(a.tipo)}</td><td>${escInternal(a.frota_geral) !== "—" ? escInternal(a.frota_geral) : a.frota_id}</td><td>${escInternal(a.descricao)}</td></tr>`).join("")}
  </table>` : ""}

  <p><a href="${appUrl}/relatorios/checklists">Ver painel completo →</a></p>

  <div class="footer">Frotas Bemol · Plataforma Operacional · ${hoje}</div>
</div></body></html>`;

  return { html, kpis, alertas, rankingFrotas, criticos };
}
