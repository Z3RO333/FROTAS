import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { FrotasPorAnoChart } from "@/components/dashboard/frotas-por-ano-chart";
import { StatusDonut } from "@/components/dashboard/status-donut";
import { EnviarRelatorioDialog } from "@/components/relatorios/enviar-relatorio-dialog";
import { PageHero, HeroStat, SectionHeader } from "@/components/ui/page-header";
import { dashboardFrotasCached } from "@/lib/repos/frotas-cache";
import { getPlanejamentoOverview } from "@/lib/repos/planejamento";
import { requireAppUser } from "@/lib/rbac";
import { formatNumber } from "@/lib/utils";
import { enviarRelatorioPainelExecutivoAction } from "./frotas/_actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAppUser();
  if (user.perfil === "MOTORISTA" || user.perfil === "MOTORISTA_INTERNO") redirect("/motorista");
  if (user.perfil === "PORTARIA" || user.perfil === "APROVADOR") redirect("/portaria");

  const [{ k, operational, conditions, byYear }, plan] = await Promise.all([
    dashboardFrotasCached(),
    getPlanejamentoOverview().catch(() => null),
  ]);

  const dispPct = plan?.disp_hoje != null ? `${(plan.disp_hoje * 100).toFixed(1)}%` : `${k.disponibilidade_pct}%`;
  const metaPct = plan?.disp_meta != null ? `${(plan.disp_meta * 100).toFixed(0)}%` : "90%";
  const disponibilidadeAtual = plan?.disp_hoje != null ? plan.disp_hoje * 100 : k.disponibilidade_pct;
  const metaAtual = plan?.disp_meta != null ? plan.disp_meta * 100 : 90;
  const atingiuMeta = disponibilidadeAtual >= metaAtual;
  return (
    <div className="space-y-7 pb-8">
      <PageHero
        eyebrow="Cockpit de Frotas"
        title="Operação Bemol"
        description="Saúde, disponibilidade e composição da frota para uma leitura executiva rápida."
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
          hint={`${atingiuMeta ? "Meta atingida" : "Abaixo da meta"} · meta ${metaPct}`}
          icon={TrendingUp}
          severity={atingiuMeta ? "OK" : "ATENCAO"}
        />
        <HeroStat
          label="Disponíveis"
          value={formatNumber(k.total_disponiveis)}
          hint={`de ${formatNumber(k.total_ativos)} frotas ativas`}
          icon={CheckCircle2}
          severity="OK"
        />
        <HeroStat
          label="Indisponíveis"
          value={formatNumber(k.total_indisponiveis)}
          hint={k.total_manutencao > 0 ? `${k.total_manutencao} em manutenção` : "sem manutenção ativa"}
          icon={XCircle}
          severity={k.total_indisponiveis > 0 ? "CRITICO" : "OK"}
        />
        <HeroStat
          label="Em atenção"
          value={formatNumber(k.total_atencao)}
          hint={`${formatNumber(k.total_critico)} em condição crítica`}
          icon={AlertTriangle}
          severity={k.total_atencao > 0 || k.total_critico > 0 ? "ATENCAO" : "OK"}
        />
      </PageHero>

      <section className="space-y-3">
        <SectionHeader
          title="Composição da frota"
          description="Distribuição operacional e condição preventiva das frotas ativas."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <StatusDonut
            title="Status operacional"
            description="Disponibilidade imediata para a operação"
            data={operational}
          />
          <StatusDonut
            title="Condição da frota"
            description="Sinais de atenção e criticidade cadastral"
            data={conditions}
          />
        </div>
      </section>

      <FrotasPorAnoChart data={byYear} />
    </div>
  );
}
