import { requireAdminUser } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { PlanejamentoTabs } from "@/components/planejamento/tabs";

export default async function PlanejamentoLayout({ children }: { children: React.ReactNode }) {
  await requireAdminUser();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planejamento de Manutenção"
        title="Cockpit Operacional"
        description="Visão consolidada da operação da frota — manutenções, documentos, disponibilidade e indicadores críticos."
      />
      <PlanejamentoTabs />
      {children}
    </div>
  );
}
