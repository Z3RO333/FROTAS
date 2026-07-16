import { NextRequest, NextResponse } from "next/server";
import { logEmail } from "@/lib/repos/email-logs";
import {
  claimDueEmailSchedules,
  completeEmailSchedule,
  releaseEmailScheduleClaim,
} from "@/lib/repos/email-schedule";
import { getEmailFrom } from "@/lib/email-from";
import {
  getDisponibilidadeResumo,
  getPontosAtencao,
  listCDsDisponibilidade,
  listFrotasEmManutencao,
  type DisponibilidadeCD,
  type DisponibilidadeGeral,
} from "@/lib/repos/disponibilidade";

import { isInternalAuthorized } from "@/lib/internal-auth";
import { getLavagem, getManutencao, getParadas } from "@/lib/repos/planejamento";
import { getCustosPorPeriodo } from "@/lib/repos/custos";
import { listAlertasAbertos } from "@/lib/repos/alertas";
import { listTacografoPorFrota } from "@/lib/repos/tacografo";
import { apiError } from "@/lib/api-error";

async function getSgMail() {
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

async function buildDisponibilidadeEmail(cdNome: string, generatedAt: Date): Promise<{ html: string; resumo: string }> {
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

async function buildOperationalEmail(tipo: string, generatedAt: Date): Promise<{ html: string; resumo: string }> {
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

export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) {
    return apiError("Nao autorizado.", 401, "INVALID_INTERNAL_TOKEN");
  }

  const schedules = await claimDueEmailSchedules({ limit: 50, excludeTipo: "RELATORIO_DIARIO_IA" });
  const cds = await listCDsDisponibilidade();
  const agora = new Date();
  const enviados: string[] = [];
  const falhas: string[] = [];

  const sgMail = await getSgMail();
  const fromEmail = getEmailFrom();

  for (const schedule of schedules) {
    const failureCountBefore = falhas.length;

    try {
      if (schedule.tipo !== "DISPONIBILIDADE") {
        const { html: corpo, resumo } = await buildOperationalEmail(schedule.tipo, agora);
        const assunto = `[FROTAS] ${schedule.nome} - ${agora.toLocaleDateString("pt-BR")}`;

        await sgMail.send({
          to: schedule.destinatarios,
          from: fromEmail,
          subject: assunto,
          html: corpo,
        });
        await logEmail({
          tipo: schedule.tipo.toLowerCase(),
          cdNome: null,
          destinatarios: schedule.destinatarios.join(","),
          assunto,
          enviadoPor: "sistema",
          status: "enviado",
          resumo,
          conteudoHtml: corpo,
          scheduleId: schedule.id,
        });
        enviados.push(schedule.nome);
        await completeEmailSchedule(schedule, agora);
        continue;
      }

      const cdsAlvo = schedule.cds_incluidos.length > 0 ? schedule.cds_incluidos : cds;
      for (const cdNome of cdsAlvo) {
        const { html, resumo } = await buildDisponibilidadeEmail(cdNome, agora);
        const assunto = `[FROTAS] Disponibilidade ${cdNome} - ${agora.toLocaleDateString("pt-BR")}`;
        const destinatarios = schedule.destinatarios.join(",");

        try {
          await sgMail.send({
            to: schedule.destinatarios,
            from: fromEmail,
            subject: assunto,
            html,
          });

          await logEmail({
            tipo: "disponibilidade_cd",
            cdNome,
            destinatarios,
            assunto,
            enviadoPor: "sistema",
            status: "enviado",
            resumo,
            conteudoHtml: html,
            scheduleId: schedule.id,
          });
          enviados.push(`${schedule.nome} (${cdNome})`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await logEmail({
            tipo: "disponibilidade_cd",
            cdNome,
            destinatarios,
            assunto,
            enviadoPor: "sistema",
            status: "erro",
            erroMsg: message,
            resumo,
            conteudoHtml: html,
            scheduleId: schedule.id,
          });
          falhas.push(`${schedule.nome} (${cdNome})`);
        }
      }

      if (falhas.length === failureCountBefore) await completeEmailSchedule(schedule, agora);
      else await releaseEmailScheduleClaim(schedule);
    } catch (err) {
      console.warn(`[email-schedule] falha ao processar "${schedule.nome}"`, err);
      falhas.push(schedule.nome);
      await releaseEmailScheduleClaim(schedule).catch((releaseError) => {
        console.error("[email-schedule] falha ao liberar claim", releaseError);
      });
    }
  }

  return NextResponse.json(
    { enviados, falhas, total: enviados.length },
    { status: falhas.length > 0 ? 500 : 200 }
  );
}
