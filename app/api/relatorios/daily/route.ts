// app/api/relatorios/daily/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRelatorioKpis, getRankingFrotas } from "@/lib/repos/relatorios";
import { listAlertasAbertos } from "@/lib/repos/alertas";
import { listAnalisesDia } from "@/lib/repos/analises-ia";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

const INTERNAL_SECRET = process.env.FROTAS_INTERNAL_SECRET ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("x-internal-secret");
  return Boolean(INTERNAL_SECRET && header === INTERNAL_SECRET);
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

  const destinatarios = (process.env.FROTAS_RELATORIO_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (destinatarios.length === 0) {
    return NextResponse.json({ aviso: "FROTAS_RELATORIO_EMAILS não configurado", html });
  }

  await supabaseManutencao.from("email_logs").insert({
    tipo: "RELATORIO_DIARIO_IA",
    destinatarios: destinatarios.join(","),
    assunto: `[Frotas] Relatório IA — ${hoje}`,
    enviado_em: new Date().toISOString(),
    enviado_por: "sistema",
    status: "SIMULADO",
    erro_msg: "Integração de envio pendente — implementar com provedor de e-mail configurado",
  });

  return NextResponse.json({
    data: hoje,
    kpis,
    total_criticos: criticos.length,
    alertas_abertos: alertas.length,
    destinatarios,
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
    <td><span class="badge badge-critico">${(a.criticidade_revisada ?? a.criticidade).replace("_", " ")}</span></td>
    <td>${a.resumo_ia ?? "—"}</td>
    <td>${a.acao_recomendada ?? "—"}</td>
  </tr>`).join("")}
  </table>` : "<p>Nenhum problema crítico hoje.</p>"}

  ${rankingFrotas.length > 0 ? `
  <h2>Frotas com mais problemas</h2>
  <table><tr><th>Frota</th><th>Placa</th><th>Problemas</th></tr>
  ${rankingFrotas.map((f) => `<tr><td>${f.frota_geral ?? f.frota_id}</td><td>${f.placa ?? "—"}</td><td>${f.total_problemas}</td></tr>`).join("")}
  </table>` : ""}

  ${alertas.length > 0 ? `
  <h2>Alertas abertos (${alertas.length})</h2>
  <table><tr><th>Tipo</th><th>Frota</th><th>Descrição</th></tr>
  ${alertas.map((a) => `<tr><td>${a.tipo}</td><td>${a.frota_geral ?? a.frota_id}</td><td>${a.descricao ?? "—"}</td></tr>`).join("")}
  </table>` : ""}

  <p><a href="${APP_URL}/relatorios/checklists">Ver painel completo →</a></p>

  <div class="footer">Frotas Bemol · Plataforma Operacional · ${hoje}</div>
</div></body></html>`;
}
