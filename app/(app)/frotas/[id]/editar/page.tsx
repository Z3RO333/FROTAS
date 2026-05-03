import { notFound } from "next/navigation";
import { FrotaForm } from "@/components/frotas/frota-form";
import { getFrota } from "@/lib/repos/frotas";
import { editarFrotaAction } from "../../_actions";

export const dynamic = "force-dynamic";

export default async function EditarFrotaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const frotaId = Number.parseInt(id, 10);
  if (Number.isNaN(frotaId)) notFound();

  const frota = await getFrota(frotaId);
  if (!frota) notFound();

  const boundAction = editarFrotaAction.bind(null, frotaId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Editar frota</h1>
        <p className="text-sm text-muted-foreground">{frota.placa ?? frota.chassi}</p>
      </div>
      <FrotaForm initial={frota} action={boundAction} submitLabel="Salvar alterações" />
    </div>
  );
}
