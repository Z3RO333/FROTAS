import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardX,
  FileText,
  Gauge,

  Timer,
  TrendingUp,
  Truck,
  Wrench,
  XCircle,
} from "lucide-react";
import { FrotasPorAnoChart } from "@/components/dashboard/frotas-por-ano-chart";
import { StatusDonut } from "@/components/dashboard/status-donut";
import { EnviarRelatorioDialog } from "@/components/relatorios/enviar-relatorio-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { dashboardFrotasCached } from "@/lib/repos/frotas-cache";
import { getPlanejamentoOverview } from "@/lib/repos/planejamento";
import { requireAppUser } from "@/lib/rbac";
import { formatNumber } from "@/lib/utils";
import { enviarRelatorioGeralAction } from "./frotas/_actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAppUser();
  if (user.perfil === "MOTORISTA") redirect("/motorista");
  if (user.perfil === "PORTARIA") redirect("/portaria");

  const [{ k, operational, conditions, byYear }, plan] = await Promise.all([
    dashboardFrotasCached(),
    getPlanejamentoOverview().catch(() => null),
  ]);

  const dispPct = plan?.disp_hoje != null ? `${(plan.disp_hoje * 100).toFixed(1)}%` : "—";
  const metaPct = plan?.disp_meta != null ? `${(plan.disp_meta * 100).toFixed(0)}%` : "90%";
  const atingiuMeta =
    plan?.disp_hoje != null && plan.disp_meta != null && plan.disp_hoje >= plan.disp_meta;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cockpit de Frotas"
        title="Operação Bemol"
        description="Visão executiva em tempo real — disponibilidade, manutenção, documentos e indicadores críticos."
        actions={
          <EnviarRelatorioDialog
            title="Enviar relatório geral"
            action={enviarRelatorioGeralAction}
          />
        }
      />

      {/* Frota — visão consolidada */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Frota</h2>
        <MetricGrid cols={5}>
          <MetricCard
            label="Total ativas"
            value={formatNumber(k.total_ativos)}
            icon={Truck}
            severity="INFO"
            href="/frotas"
          />
          <MetricCard
            label="Disponíveis"
            value={formatNumber(k.total_disponiveis)}
            icon={CheckCircle2}
            severity="OK"
            href="/frotas?operacional=disponivel"
          />
          <MetricCard
            label="Em manutenção"
            value={formatNumber(k.total_manutencao)}
            icon={Wrench}
            severity="MANUTENCAO"
            href="/frotas?operacional=manutencao"
            hint={
              k.total_manutencao_atrasada > 0
                ? `${k.total_manutencao_atrasada} com retorno atrasado`
                : k.total_manutencao_longa > 0
                  ? `${k.total_manutencao_longa} há mais de 7 dias`
                  : undefined
            }
          />
          <MetricCard
            label="Indisponíveis"
            value={formatNumber(k.total_indisponiveis)}
            icon={XCircle}
            severity="CRITICO"
            href="/frotas?operacional=indisponivel"
          />
          <MetricCard
            label="Em atenção"
            value={formatNumber(k.total_atencao)}
            icon={AlertTriangle}
            severity="ATENCAO"
            href="/frotas?condicao=atencao"
          />
        </MetricGrid>
      </section>

      {/* Disponibilidade + Indicadores críticos */}
      {plan && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Indicadores operacionais
          </h2>
          <MetricGrid cols={5}>
            <MetricCard
              label="Disponibilidade"
              value={dispPct}
              icon={TrendingUp}
              severity={atingiuMeta ? "OK" : "ATENCAO"}
              hint={`Meta ${metaPct}`}
              href="/planejamento/disponibilidade"
            />
            <MetricCard
              label="Docs vencidos"
              value={plan.docs_vencidos}
              icon={FileText}
              severity="CRITICO"
              href="/planejamento/documentos"
            />
            <MetricCard
              label="Manutenções atrasadas"
              value={plan.manut_atrasadas}
              icon={Wrench}
              severity="ATENCAO"
              href="/planejamento/manutencao"
            />

            <MetricCard
              label="Lavagem atrasada"
              value={plan.lavagem_atrasada}
              icon={ClipboardCheck}
              severity="ATENCAO"
              href="/planejamento/lavagem"
            />
          </MetricGrid>
        </section>
      )}

      {/* Cadastro e Operação */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cadastro e dados
        </h2>
        <MetricGrid cols={4}>
          <MetricCard
            label="Sem KM informado"
            value={formatNumber(k.total_sem_km)}
            icon={Gauge}
            severity="ATENCAO"
            href="/frotas?semKm=1"
          />
          <MetricCard
            label="Cadastro incompleto"
            value={formatNumber(k.total_cadastro_incompleto)}
            icon={ClipboardX}
            severity="ATENCAO"
            href="/frotas?cadastro=incompleto"
          />
          <MetricCard
            label="Idade média"
            value={k.idade_media != null ? `${k.idade_media.toFixed(1)}a` : "—"}
            icon={Timer}
            severity="NEUTRO"
            hint={`${formatNumber(k.total_acima_7)} acima de 7 anos`}
            href="/frotas?idadeMin=7"
          />
          <MetricCard
            label="KM médio"
            value={k.km_medio != null ? formatNumber(Math.round(k.km_medio)) : "—"}
            icon={Gauge}
            severity="NEUTRO"
          />
        </MetricGrid>
      </section>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <StatusDonut title="Status operacional" data={operational} />
        <StatusDonut title="Condição da frota" data={conditions} />
      </div>

      <FrotasPorAnoChart data={byYear} />
    </div>
  );
}
