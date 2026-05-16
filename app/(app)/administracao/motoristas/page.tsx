import { Users } from "lucide-react";
import { requireAppUser } from "@/lib/rbac";
import { listMotoristasStats } from "@/lib/repos/motoristas";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MotoristasAdminPage() {
  await requireAppUser();
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

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b">
              <th className="p-3 text-left font-medium text-muted-foreground">Motorista</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Movimentações</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Frotas distintas</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Saídas</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Última movimentação</th>
            </tr>
          </thead>
          <tbody>
            {motoristas.map((m) => (
              <tr
                key={m.motorista_id}
                className="border-b odd:bg-white even:bg-slate-50/60 last:border-0"
              >
                <td className="p-3">
                  <div className="font-medium">{m.motorista_nome ?? m.motorista_id}</div>
                  <div className="text-xs text-muted-foreground">{m.motorista_id}</div>
                </td>
                <td className="p-3 text-right tabular-nums">{m.total_movimentacoes.toLocaleString("pt-BR")}</td>
                <td className="p-3 text-right tabular-nums">{m.frotas_distintas}</td>
                <td className="p-3 text-right tabular-nums">{m.total_saidas.toLocaleString("pt-BR")}</td>
                <td className="p-3 text-right">
                  {m.ultima_movimentacao ? formatDate(m.ultima_movimentacao) : "—"}
                </td>
              </tr>
            ))}
            {motoristas.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Nenhuma movimentação registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
