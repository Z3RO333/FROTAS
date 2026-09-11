import { Combine } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { UnificacoesTabs } from "@/components/administracao/unificacoes-tabs";
import { requireGestorUser } from "@/lib/rbac";

export default async function UnificacoesLayout({ children }: { children: React.ReactNode }) {
  await requireGestorUser();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administração" title="Unificações"
        description="Padronize nomes repetidos ou divergentes usados nos cadastros da frota."
        icon={Combine} severity="INFO" />
      <UnificacoesTabs />
      {children}
    </div>
  );
}
