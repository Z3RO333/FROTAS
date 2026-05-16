// app/api/relatorios/daily/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRelatorioKpis, getRankingFrotas } from "@/lib/repos/relatorios";
import { listAlertasAbertos } from "@/lib/repos/alertas";
import { listAnalisesDia } from "@/lib/repos/analises-ia";
import { sendRelatorioDiarioIa } from "@/lib/email";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

const INTERNAL_SECRET = process.env.FROTAS_INTERNAL_SECRET ?? "";
const APP_URL = process.env.FROTAS_APP_URL ?? "http://localhost:3000";

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("x-internal-secret");
  return Boolean(INTERNAL_SECRET && header === INTERNAL_SECRET);
}

function esc(s: string | null | undefined): string {
  return (s ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hoje = new Date().toISOString().slice(0, 10);

  const [kpis, alertas, rankingFrotas, analises] = await Promise.all([
    getRelatorioKpis(hoje),
    listAlertasAbertos(10),
    getRankingFrotas(hoje, 5),
    listAnalisesDia(hoje),
  ]);

  const criticos = analises.filter((a) =>
    ["CRITICO", "BLOQUEIO_SUGERIDO"].includes(a.criticidade_revisada ?? a.criticidade)
  );

  const html = buildEmailHtml({ hoje, kpis, alertas, rankingFrotas, criticos });

  // Le destinatarios das agendas ativas do tipo RELATORIO_DIARIO_IA
  const { data: schedules, error: schedulesError } = await supabaseManutencao
    .from("email_schedules")
    .select("id, destinatarios")
    .eq("tipo", "RELATORIO_DIARIO_IA")
    .eq("ativo", true);

  if (schedulesError) {
    console.error("[relatorios/daily] falha ao buscar email_schedules", schedulesError);
    return NextResponse.json({ erro: "Falha ao buscar destinatarios", detalhe: schedulesError.message }, { status: 500 });
  }

  const destinatarios = Array.from(
    new Set(
      (schedules ?? [])
        .flatMap((s) => (s.destinatarios as string[] | null) ?? [])
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (destinatarios.length === 0) {
    return NextResponse.json({
      aviso: "Nenhuma agenda ativa do tipo RELATORIO_DIARIO_IA. Cadastre em /administracao/emails.",
      html_preview: html.slice(0, 500),
    });
  }

  const assunto = `[Frotas] Relatório IA — ${hoje}`;
  const sendResult = await sendRelatorioDiarioIa({ destinatarios, html, assunto });

  // Marca ultimo_envio nas schedules usadas
  if (sendResult.ok && schedules && schedules.length > 0) {
    const scheduleIds = schedules.map((s) => s.id);
    await supabaseManutencao
      .from("email_schedules")
      .update({ ultimo_envio: new Date().toISOString() })
      .in("id", scheduleIds)
      .then((res) => {
        if (res.error) console.warn("[relatorios/daily] falha ao atualizar ultimo_envio", res.error);
      });
  }

  return NextResponse.json({
    data: hoje,
    kpis,
    total_criticos: criticos.length,
    alertas_abertos: alertas.length,
    destinatarios,
    enviado: sendResult.ok,
    erro_envio: sendResult.ok ? null : sendResult.error,
    html_preview: html.slice(0, 500),
  });
}

type BuildEmailParams = {
  hoje: string;
  kpis: Awaited<ReturnType<typeof getRelatorioKpis>>;
  alertas: Awaited<ReturnType<typeof listAlertasAbertos>>;
  rankingFrotas: Awaited<ReturnType<typeof getRankingFrotas>>;
  criticos: Awaited<ReturnType<typeof listAnalisesDia>>;
};

function buildEmailHtml({ hoje, kpis, alertas, rankingFrotas, criticos }: BuildEmailParams): string {
  return `<!DOCTYPE html>
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
    <td><span class="badge badge-critico">${esc((a.criticidade_revisada ?? a.criticidade).replace("_", " "))}</span></td>
    <td>${esc(a.resumo_ia)}</td>
    <td>${esc(a.acao_recomendada)}</td>
  </tr>`).join("")}
  </table>` : "<p>Nenhum problema crítico hoje.</p>"}

  ${rankingFrotas.length > 0 ? `
  <h2>Frotas com mais problemas</h2>
  <table><tr><th>Frota</th><th>Placa</th><th>Problemas</th></tr>
  ${rankingFrotas.map((f) => `<tr><td>${esc(f.frota_geral) !== "—" ? esc(f.frota_geral) : f.frota_id}</td><td>${esc(f.placa)}</td><td>${f.total_problemas}</td></tr>`).join("")}
  </table>` : ""}

  ${alertas.length > 0 ? `
  <h2>Alertas abertos (${alertas.length})</h2>
  <table><tr><th>Tipo</th><th>Frota</th><th>Descrição</th></tr>
  ${alertas.map((a) => `<tr><td>${esc(a.tipo)}</td><td>${esc(a.frota_geral) !== "—" ? esc(a.frota_geral) : a.frota_id}</td><td>${esc(a.descricao)}</td></tr>`).join("")}
  </table>` : ""}

  <p><a href="${APP_URL}/relatorios/checklists">Ver painel completo →</a></p>

  <div class="footer">Frotas Bemol · Plataforma Operacional · ${hoje}</div>
</div></body></html>`;
}
