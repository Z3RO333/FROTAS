import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
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
import { PageHero, HeroStat } from "@/components/ui/page-header";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { dashboardFrotasCached } from "@/lib/repos/frotas-cache";
import { getPlanejamentoOverview } from "@/lib/repos/planejamento";
import { requireAppUser } from "@/lib/rbac";
import { formatNumber } from "@/lib/utils";
import { enviarRelatorioPainelExecutivoAction } from "./frotas/_actions";

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

  const criticosTotal = k.total_indisponiveis + (k.total_manutencao_atrasada ?? 0);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Cockpit de Frotas"
        title="Operação Bemol"
        description="Visão executiva em tempo real — disponibilidade, manutenção, documentos e indicadores críticos."
        icon={Gauge}
        actions={
          <EnviarRelatorioDialog
            title="Enviar painel executivo"
            action={enviarRelatorioPainelExecutivoAction}
          />
        }
      >
        <HeroStat
          label="Disponibilidade"
          value={dispPct}
          hint={`Meta ${metaPct}`}
          icon={TrendingUp}
          severity={atingiuMeta ? "OK" : "ATENCAO"}
        />
        <HeroStat
          label="Frotas ativas"
          value={formatNumber(k.total_ativos)}
          hint={`${formatNumber(k.total_disponiveis)} disponíveis`}
          icon={Truck}
          severity="INFO"
        />
        <HeroStat
          label="Em atenção crítica"
          value={formatNumber(criticosTotal)}
          hint={
            k.total_manutencao_atrasada > 0
              ? `${k.total_manutencao_atrasada} manutenções atrasadas`
              : "Indisponíveis + atrasos"
          }
          icon={AlertTriangle}
          severity="CRITICO"
        />
        <HeroStat
          label="Meta operacional"
          value={metaPct}
          hint={atingiuMeta ? "Meta atingida hoje" : "Abaixo da meta"}
          icon={atingiuMeta ? CheckCircle2 : Timer}
          severity={atingiuMeta ? "OK" : "ATENCAO"}
        />
      </PageHero>

      {/* Frota — visão consolidada */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="h-1 w-6 rounded-full bg-blue-500" />
          Frota
        </h2>
        <MetricGrid cols={4}>
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
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span className="h-1 w-6 rounded-full bg-emerald-500" />
            Indicadores operacionais
          </h2>
          <MetricGrid cols={4}>
            <MetricCard
              label="Disponibilidade"
              value={dispPct}
              icon={TrendingUp}
              severity={atingiuMeta ? "OK" : "ATENCAO"}
              hint={`Meta ${metaPct}`}
              href="/frotas/disponibilidades"
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
            <MetricCard
              label="Custo de ordens"
              value="R$ 0,00"
              icon={DollarSign}
              severity="NEUTRO"
              hint="Aguardando ordens"
              href="/manutencao/ordens"
            />
            <MetricCard
              label="Total de ordens"
              value={0}
              icon={FileText}
              severity="NEUTRO"
              hint="Aguardando ordens"
              href="/manutencao/ordens"
            />
          </MetricGrid>
        </section>
      )}

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <StatusDonut title="Status operacional" data={operational} />
        <StatusDonut title="Condição da frota" data={conditions} />
      </div>

      <FrotasPorAnoChart data={byYear} />
    </div>
  );
}
