import { frotaReturnTo } from "@/lib/navigation/search-state";
import { notFound } from "next/navigation";
import { FrotaForm } from "@/components/frotas/frota-form";
import { FrotaStatusActions } from "@/components/frotas/frota-status-actions";
import { getFrota } from "@/lib/repos/frotas";
import { setoresDistintosCached } from "@/lib/repos/frotas-cache";
import { requireGestorUser } from "@/lib/rbac";
import { editarFrotaAction } from "../../_actions";

export const dynamic = "force-dynamic";

export default async function EditarFrotaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const returnTo = frotaReturnTo((await searchParams).returnTo);
  const frotaId = Number.parseInt(id, 10);
  if (Number.isNaN(frotaId)) notFound();

  await requireGestorUser();

  const frota = await getFrota(frotaId);
  if (!frota) notFound();

  const setores = await setoresDistintosCached();
  const boundAction = editarFrotaAction.bind(null, frotaId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Editar frota</h1>
          <p className="text-sm text-muted-foreground">{frota.placa ?? frota.chassi}</p>
        </div>
        <FrotaStatusActions
          returnTo={returnTo}
          id={frota.id}
          label={frota.placa ?? frota.chassi ?? `#${frota.id}`}
          ativo={frota.ativo}
          vendido={frota.vendido}
        />
      </div>
      <FrotaForm returnTo={returnTo} initial={frota} action={boundAction} submitLabel="Salvar alterações" setores={setores} />
    </div>
  );
}
