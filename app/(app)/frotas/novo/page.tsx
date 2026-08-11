import { FrotaForm } from "@/components/frotas/frota-form";
import { localizacoesDistintasCached } from "@/lib/repos/frotas-cache";
import { requireGestorUser } from "@/lib/rbac";
import { criarFrotaAction } from "../_actions";

export const dynamic = "force-dynamic";

export default async function NovaFrotaPage() {
  // Mesmo guard da página de edição — sem isso qualquer perfil logado via o form.
  await requireGestorUser();
  const setores = await localizacoesDistintasCached();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Nova frota</h1>
        <p className="text-sm text-muted-foreground">Cadastre um novo veículo da frota.</p>
      </div>
      <FrotaForm action={criarFrotaAction} submitLabel="Cadastrar" setores={setores} />
    </div>
  );
}
