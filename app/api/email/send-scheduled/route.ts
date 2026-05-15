import { NextRequest, NextResponse } from "next/server";
import { listEmailSchedules } from "@/lib/repos/email-schedule";
import { getDisponibilidadeGeral } from "@/lib/repos/disponibilidade";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

const INTERNAL_SECRET = process.env.FROTAS_INTERNAL_SECRET ?? "";

function isAuthorized(req: NextRequest): boolean {
  return Boolean(INTERNAL_SECRET && req.headers.get("x-internal-secret") === INTERNAL_SECRET);
}

async function getSgMail() {
  const sgMail = await import("@sendgrid/mail");
  const key = process.env.SENDGRID_API_KEY ?? "";
  if (key) sgMail.default.setApiKey(key);
  return sgMail.default;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const schedules = await listEmailSchedules();
  const agora = new Date();
  const enviados: string[] = [];
  const falhas: string[] = [];

  const sgMail = await getSgMail();
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? "noreply@bemol.com.br";

  for (const s of schedules) {
    if (!s.ativo) continue;

    const proximo = s.proximo_envio ? new Date(s.proximo_envio) : null;
    if (proximo && proximo > agora) continue;

    try {
      let corpo = `<h2 style="font-family:sans-serif;">${s.nome}</h2>`;

      if (s.tipo === "DISPONIBILIDADE") {
        const geral = await getDisponibilidadeGeral();
        corpo += `
          <p style="font-family:sans-serif;">
            <strong>Disponibilidade geral: ${geral.percentual_disponibilidade}%</strong>
          </p>
          <ul style="font-family:sans-serif;">
            <li>Frotas disponíveis: ${geral.disponiveis} / ${geral.total}</li>
            <li>Em manutenção: ${geral.em_manutencao}</li>
            <li>Paradas: ${geral.paradas}</li>
          </ul>`;
      } else {
        corpo += `<p style="font-family:sans-serif;">Relatório de tipo <strong>${s.tipo}</strong>.</p>`;
      }

      corpo += `<hr/><p style="font-family:sans-serif;color:#888;font-size:12px;">
        Enviado automaticamente pelo sistema FROTAS Bemol em ${agora.toLocaleString("pt-BR")}
      </p>`;

      await sgMail.send({
        to: s.destinatarios,
        from: fromEmail,
        subject: `[FROTAS] ${s.nome} — ${agora.toLocaleDateString("pt-BR")}`,
        html: corpo,
      });

      const proximaData = new Date(agora);
      if (s.frequencia === "DIARIO") proximaData.setDate(proximaData.getDate() + 1);
      else if (s.frequencia === "SEMANAL") proximaData.setDate(proximaData.getDate() + 7);
      else if (s.frequencia === "QUINZENAL") proximaData.setDate(proximaData.getDate() + 15);
      else if (s.frequencia === "MENSAL") proximaData.setMonth(proximaData.getMonth() + 1);

      await supabaseManutencao
        .from("email_schedules")
        .update({
          ultimo_envio: agora.toISOString(),
          proximo_envio: proximaData.toISOString(),
          atualizado_em: agora.toISOString(),
        })
        .eq("id", s.id);

      enviados.push(s.nome);
    } catch (err) {
      console.warn(`[email-schedule] falha ao enviar "${s.nome}"`, err);
      falhas.push(s.nome);
    }
  }

  return NextResponse.json({ enviados, falhas, total: enviados.length });
}
