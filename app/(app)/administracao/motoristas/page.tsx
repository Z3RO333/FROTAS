import { Users } from "lucide-react";
import { MotoristasTable } from "@/components/administracao/motoristas-table";
import { PageHeader } from "@/components/ui/page-header";
import { requireUserManager } from "@/lib/rbac";
import { listMotoristasStats } from "@/lib/repos/motoristas";

export const dynamic = "force-dynamic";

export default async function MotoristasAdminPage() {
  await requireUserManager();
  const motoristas = await listMotoristasStats();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administração"
        title="Motoristas"
        description={`${motoristas.length} motorista(s) com movimentações registradas.`}
        icon={Users}
        severity="INFO"
      />

      <MotoristasTable motoristas={motoristas} />
    </div>
  );
}
