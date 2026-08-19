import { CheckCircle2, ClipboardCheck, Clock, DoorOpen, LogIn } from "lucide-react";
import { canApprovePortariaExit, requirePortariaUser } from "@/lib/rbac";
import { listPortariaToday } from "@/lib/repos/checklists";
import { PortariaClient } from "./portaria-client";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortariaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePortariaUser();
  const sp = await searchParams;
  const rows = await listPortariaToday();

  const kpis = {
    checklistsHoje: rows.filter((r) => r.checklist_id).length,
    liberadas: rows.filter((r) => r.status_portaria === "LIBERADA_SAIDA").length,
    saidasRegistradas: rows.filter((r) => r.status_portaria === "SAIDA_REGISTRADA").length,
    pendentes: rows.filter((r) => r.status_portaria === "PENDENTE_CHECKLIST").length,
  };

  const initialStatus = sp.status ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Portaria"
        title="Liberação de Frotas"
        description={`Hoje: ${formatDate(new Date())} · ${rows.length} frota(s) ativa(s).`}
        icon={DoorOpen}
        severity="INFO"
      />

      <MetricGrid cols={4}>
        <MetricCard
          label="Checklists hoje"
          value={kpis.checklistsHoje}
          icon={ClipboardCheck}
          severity="INFO"
          href="?status=COM_CHECKLIST"
        />
        <MetricCard
          label="Liberadas"
          value={kpis.liberadas}
          icon={CheckCircle2}
          severity="OK"
          href="?status=LIBERADA_SAIDA"
        />
        <MetricCard
          label="Saídas"
          value={kpis.saidasRegistradas}
          icon={LogIn}
          severity="INFO"
          href="?status=SAIDA_REGISTRADA"
        />
        <MetricCard
          label="Pendentes"
          value={kpis.pendentes}
          icon={Clock}
          severity="ATENCAO"
          href="?status=PENDENTE_CHECKLIST"
        />
      </MetricGrid>

      <PortariaClient
        rows={rows}
        erro={sp.erro}
        canApproveExit={canApprovePortariaExit(user.perfil)}
        initialStatus={initialStatus}
      />
    </div>
  );
}
