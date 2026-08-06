import {
  getDisponibilidadeResumo,
  getPontosAtencao,
  listFrotasEmManutencao,
  type DisponibilidadeCD,
  type DisponibilidadeGeral,
} from "@/lib/repos/disponibilidade";
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

function asCdResumo(resumo: DisponibilidadeCD | DisponibilidadeGeral, cdNome: string): DisponibilidadeCD {
  return "cd_nome" in resumo ? resumo : { cd_nome: cdNome, ...resumo };
}

function resumoTexto(cd: DisponibilidadeCD): string {
  return `${cd.cd_nome}: ${cd.percentual_disponibilidade}% disponível, ${cd.disponiveis}/${cd.total} frotas disponíveis, ${cd.em_manutencao} em manutenção, ${cd.indisponiveis} indisponíveis, ${cd.pontos_atencao} ponto(s) de atenção.`;
}

export async function buildDisponibilidadeEmail(cdNome: string, generatedAt: Date): Promise<{ html: string; resumo: string }> {
  const [resumoRaw, manutencoes, pontos] = await Promise.all([
    getDisponibilidadeResumo(cdNome),
    listFrotasEmManutencao(cdNome, 80),
    getPontosAtencao(30, cdNome),
  ]);
  const resumo = asCdResumo(resumoRaw, cdNome);
  const resumoCurto = resumoTexto(resumo);

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <style>
    body { margin:0; padding:0; background:#f8fafc; color:#0f172a; font-family:Arial,sans-serif; }
    .wrap { max-width:920px; margin:0 auto; padding:24px 12px; }
    .panel { background:#fff; border:1px solid #dbe7f5; border-radius:14px; overflow:hidden; }
    .header { background:#0b3f8e; color:#fff; padding:22px 24px; }
    h1 { margin:0; font-size:22px; }
    h2 { margin:24px 0 10px; font-size:15px; color:#334155; }
    .muted { color:#64748b; font-size:12px; }
    .body { padding:22px 24px 26px; }
    .kpis { width:100%; border-collapse:separate; border-spacing:8px; margin:12px -8px; }
    .kpi { border:1px solid #e2e8f0; border-radius:10px; padding:12px; background:#f8fafc; }
    .label { color:#64748b; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
    .value { font-size:24px; font-weight:800; margin-top:2px; }
    table.data { width:100%; border-collapse:collapse; font-size:12px; }
    table.data th { text-align:left; background:#f1f5f9; padding:8px; border-bottom:1px solid #e2e8f0; }
    table.data td { padding:8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
    .badge { display:inline-block; border-radius:999px; padding:3px 8px; font-size:11px; font-weight:700; }
    .critico { background:#fee2e2; color:#991b1b; }
    .atencao { background:#fef3c7; color:#92400e; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="panel">
      <div class="header">
        <h1>Disponibilidade de Frotas - ${esc(resumo.cd_nome)}</h1>
        <div class="muted" style="color:#dbeafe;margin-top:6px;">Relatório gerado em ${esc(formatDateTime(generatedAt))}</div>
      </div>
      <div class="body">
        <p>${esc(resumoCurto)}</p>
        <table class="kpis" role="presentation">
          <tr>
            <td class="kpi"><div class="label">Total</div><div class="value">${resumo.total}</div></td>
            <td class="kpi"><div class="label">Disponíveis</div><div class="value" style="color:#047857;">${resumo.disponiveis}</div></td>
            <td class="kpi"><div class="label">Manutenção</div><div class="value" style="color:#7c3aed;">${resumo.em_manutencao}</div></td>
            <td class="kpi"><div class="label">Indisponíveis</div><div class="value" style="color:#dc2626;">${resumo.indisponiveis}</div></td>
            <td class="kpi"><div class="label">Operação</div><div class="value">${resumo.em_operacao}</div></td>
            <td class="kpi"><div class="label">Disponibilidade</div><div class="value">${resumo.percentual_disponibilidade}%</div></td>
          </tr>
        </table>

        <h2>Frotas em manutenção</h2>
        ${
          manutencoes.length === 0
            ? "<p class=\"muted\">Nenhuma frota em manutenção neste CD.</p>"
            : `<table class="data">
              <tr><th>Placa</th><th>Modelo</th><th>Motivo</th><th>Envio</th><th>Tempo parado</th><th>Local atual</th><th>Responsavel</th></tr>
              ${manutencoes
                .map(
                  (f) => `<tr>
                    <td>${esc(f.placa ?? f.frota_geral ?? f.id)}</td>
                    <td>${esc(f.modelo)}</td>
                    <td>${esc(f.motivo ?? f.tipo)}</td>
                    <td>${esc(f.data_envio ? new Date(f.data_envio).toLocaleDateString("pt-BR") : null)}</td>
                    <td>${esc(f.tempo_parado_dias != null ? `${f.tempo_parado_dias} dia(s)` : null)}</td>
                    <td>${esc(f.local_atual)}</td>
                    <td>${esc(f.responsavel)}</td>
                  </tr>`
                )
                .join("")}
            </table>`
        }

        <h2>Pontos de atenção</h2>
        ${
          pontos.length === 0
            ? "<p class=\"muted\">Nenhum ponto de atenção automático para este CD.</p>"
            : `<table class="data">
              <tr><th>Severidade</th><th>Frota</th><th>Ponto</th><th>Descricao</th></tr>
              ${pontos
                .map(
                  (p) => `<tr>
                    <td><span class="badge ${p.severidade === "CRITICO" ? "critico" : "atencao"}">${esc(p.severidade)}</span></td>
                    <td>${esc(p.placa ?? p.frota_geral ?? p.frota_id)}</td>
                    <td>${esc(p.titulo)}</td>
                    <td>${esc(p.descricao)}</td>
                  </tr>`
                )
                .join("")}
            </table>`
        }

        <p class="muted" style="margin-top:24px;">Frotas Bemol - envio automático por CD.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { html, resumo: resumoCurto };
}

type ReportRow = Record<string, string | number | null | undefined>;

function buildTable(title: string, rows: ReportRow[], generatedAt: Date): { html: string; resumo: string } {
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
  throw new Error(`Tipo de agenda não suportado neste endpoint: ${tipo}`);
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
