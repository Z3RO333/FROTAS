import { DoorOpen } from "lucide-react";
import { canApprovePortariaExit, requirePortariaUser } from "@/lib/rbac";
import { listPortariaToday } from "@/lib/repos/checklists";
import { PortariaClient } from "./portaria-client";
import { PageHeader } from "@/components/ui/page-header";
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

      <PortariaClient
        rows={rows}
        erro={sp.erro}
        canApproveExit={canApprovePortariaExit(user.perfil)}
        initialStatus={initialStatus}
      />
    </div>
  );
}
