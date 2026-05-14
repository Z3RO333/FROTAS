import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Truck,
  Wrench,
} from "lucide-react";
import { getPlanejamentoOverview } from "@/lib/repos/planejamento";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function PlanejamentoPage() {
  const k = await getPlanejamentoOverview();

  const dispPct = k.disp_hoje != null ? `${(k.disp_hoje * 100).toFixed(1)}%` : "—";
  const metaPct = k.disp_meta != null ? `${(k.disp_meta * 100).toFixed(0)}%` : "90%";
  const noData = k.docs_vencidos + k.manut_atrasadas + k.lavagem_atrasada + k.pneus_total === 0;

  if (noData) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Sem dados de planejamento"
        description="Rode o import da planilha para carregar os dados."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Indicadores críticos
        </h2>
        <MetricGrid cols={5}>
          <MetricCard
            label="Docs vencidos"
            value={k.docs_vencidos}
            icon={FileText}
            severity="CRITICO"
            href="/planejamento/documentos"
            hint="Tacógrafo, CRLV, DUT"
          />
          <MetricCard
            label="Manutenções atrasadas"
            value={k.manut_atrasadas}
            icon={Wrench}
            severity="ATENCAO"
            href="/planejamento/manutencao"
            hint={`${k.manut_ok} em dia`}
          />
          <MetricCard
            label="Lavagem atrasada"
            value={k.lavagem_atrasada}
            icon={ClipboardCheck}
            severity="ATENCAO"
            href="/planejamento/lavagem"
          />
          <MetricCard
            label="Sem kit completo"
            value={k.sem_kit_completo}
            icon={ShieldAlert}
            severity="CRITICO"
            href="/planejamento/seguranca"
          />
          <MetricCard
            label="Sem estepe"
            value={k.sem_estepe}
            icon={AlertTriangle}
            severity="CRITICO"
            href="/planejamento/estepes"
          />
        </MetricGrid>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operação</h2>
        <MetricGrid cols={4}>
          <MetricCard
            label="Disponibilidade"
            value={dispPct}
            icon={TrendingUp}
            severity={
              k.disp_hoje != null && k.disp_meta != null && k.disp_hoje >= k.disp_meta
                ? "OK"
                : "ATENCAO"
            }
            href="/planejamento/disponibilidade"
            hint={`Meta ${metaPct}`}
          />
          <MetricCard
            label="Manutenções OK"
            value={k.manut_ok}
            icon={CheckCircle2}
            severity="OK"
            href="/planejamento/manutencao"
          />
          <MetricCard
            label="Pneus mapeados"
            value={k.pneus_total}
            icon={Truck}
            severity="INFO"
            href="/planejamento/pneus"
          />
          <MetricCard
            label="Meta operacional"
            value={metaPct}
            icon={Gauge}
            severity="NEUTRO"
            hint="Disponibilidade alvo"
          />
        </MetricGrid>
      </section>
    </div>
  );
}
