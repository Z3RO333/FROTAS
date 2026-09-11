import { MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SetorRenameRow } from "@/components/administracao/setor-rename-row";
import { requireGestorUser } from "@/lib/rbac";
import { listSetoresComContagem } from "@/lib/repos/setores";

export const dynamic = "force-dynamic";

export default async function SetoresPage() {
  await requireGestorUser();
  const setores = await listSetoresComContagem();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Setores"
        description="Padronize nomes divergentes do mesmo setor (ex.: duas grafias de 'Assistência Técnica'). Renomear um setor atualiza todas as frotas vinculadas e as agendas de e-mail que o referenciam."
        icon={MapPin}
        severity="INFO"
      />

      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b px-5 py-3 text-sm text-muted-foreground">
          {setores.length} setor(es) cadastrado(s) em veículos ativos, ocultos e vendidos.
        </div>
        {setores.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum setor cadastrado ainda.</p>
        ) : (
          <div className="overflow-x-auto px-5 py-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 text-left">Setor</th>
                  <th className="py-2 pr-4 text-right">Frotas</th>
                  <th className="py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {setores.map(({ setor, total }) => (
                  <SetorRenameRow key={setor} setor={setor} total={total} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
