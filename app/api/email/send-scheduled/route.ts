import { NextRequest, NextResponse } from "next/server";
import { logEmail } from "@/lib/repos/email-logs";
import { listEmailSchedules, type EmailSchedule } from "@/lib/repos/email-schedule";
import { getEmailFrom } from "@/lib/email-from";
import {
  getDisponibilidadeResumo,
  getPontosAtencao,
  listCDsDisponibilidade,
  listFrotasEmManutencao,
  type DisponibilidadeCD,
  type DisponibilidadeGeral,
} from "@/lib/repos/disponibilidade";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

import { isInternalAuthorized } from "@/lib/internal-auth";

async function getSgMail() {
  const sgMail = await import("@sendgrid/mail");
  const key = process.env.SENDGRID_API_KEY ?? "";
  if (key) sgMail.default.setApiKey(key);
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

function scheduledAtToday(schedule: EmailSchedule, now: Date): Date {
  const [hour, minute] = String(schedule.hora_envio ?? "07:00")
    .slice(0, 5)
    .split(":")
    .map((part) => Number.parseInt(part, 10));
  const date = new Date(now);
  date.setHours(Number.isFinite(hour) ? hour : 7, Number.isFinite(minute) ? minute : 0, 0, 0);
  return date;
}

function shouldSend(schedule: EmailSchedule, now: Date): boolean {
  if (!schedule.ativo) return false;
  if (schedule.proximo_envio) return new Date(schedule.proximo_envio) <= now;
  return scheduledAtToday(schedule, now) <= now;
}

function nextRun(schedule: EmailSchedule, from: Date): Date {
  const next = scheduledAtToday(schedule, from);
  if (next <= from) {
    if (schedule.frequencia === "SEMANAL") next.setDate(next.getDate() + 7);
    else if (schedule.frequencia === "QUINZENAL") next.setDate(next.getDate() + 15);
    else if (schedule.frequencia === "MENSAL") next.setMonth(next.getMonth() + 1);
    else next.setDate(next.getDate() + 1);
  }
  return next;
}

async function updateScheduleRun(schedule: EmailSchedule, now: Date) {
  const proximaData = nextRun(schedule, now);
  await supabaseManutencao
    .from("email_schedules")
    .update({
      ultimo_envio: now.toISOString(),
      proximo_envio: proximaData.toISOString(),
      atualizado_em: now.toISOString(),
    })
    .eq("id", schedule.id);
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

export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const schedules = await listEmailSchedules();
  const cds = await listCDsDisponibilidade();
  const agora = new Date();
  const enviados: string[] = [];
  const falhas: string[] = [];

  const sgMail = await getSgMail();
  const fromEmail = getEmailFrom();

  for (const schedule of schedules) {
    if (!shouldSend(schedule, agora)) continue;

    try {
      if (schedule.tipo !== "DISPONIBILIDADE") {
        const corpo = `<h2 style="font-family:sans-serif;">${esc(schedule.nome)}</h2>
          <p style="font-family:sans-serif;">Relatório de tipo <strong>${esc(schedule.tipo)}</strong>.</p>
          <hr/>
          <p style="font-family:sans-serif;color:#888;font-size:12px;">
            Enviado automaticamente pelo sistema FROTAS Bemol em ${esc(formatDateTime(agora))}
          </p>`;

        await sgMail.send({
          to: schedule.destinatarios,
          from: fromEmail,
          subject: `[FROTAS] ${schedule.nome} - ${agora.toLocaleDateString("pt-BR")}`,
          html: corpo,
        });
        enviados.push(schedule.nome);
        await updateScheduleRun(schedule, agora);
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

      await updateScheduleRun(schedule, agora);
    } catch (err) {
      console.warn(`[email-schedule] falha ao processar "${schedule.nome}"`, err);
      falhas.push(schedule.nome);
    }
  }

  return NextResponse.json({ enviados, falhas, total: enviados.length });
}
