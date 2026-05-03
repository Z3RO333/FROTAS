import { FrotaForm } from "@/components/frotas/frota-form";
import { criarFrotaAction } from "../_actions";

export default function NovaFrotaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Nova frota</h1>
        <p className="text-sm text-muted-foreground">Cadastre um novo veículo da frota.</p>
      </div>
      <FrotaForm action={criarFrotaAction} submitLabel="Cadastrar" />
    </div>
  );
}
