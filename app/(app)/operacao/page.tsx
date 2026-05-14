import { requireAppUser, canAccessOperacao } from "@/lib/rbac";
import { listDemandas, kpisDemandas } from "@/lib/repos/manutencao/operacao";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { DemandaApp, StatusDemanda } from "@/lib/repos/manutencao/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<StatusDemanda, string> = {
  disponivel: "Disponível",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_CLASS: Record<StatusDemanda, string> = {
  disponivel: "border-slate-200 bg-slate-100 text-slate-800",
  em_andamento: "border-blue-200 bg-blue-50 text-blue-800",
  concluido: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelado: "border-red-200 bg-red-50 text-red-800",
};

export default async function OperacaoPage() {
  const user = await requireAppUser();
  if (!canAccessOperacao(user.perfil)) redirect("/");

  const [demandas, kpis] = await Promise.all([listDemandas(), kpisDemandas()]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Operação</p>
        <h1 className="text-3xl font-semibold tracking-tight">Demandas de Operação</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.entries(kpis) as [StatusDemanda, number][]).map(([s, n]) => (
          <Card key={s} className="rounded-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{STATUS_LABEL[s]}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{n}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="overflow-hidden rounded-md border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Destino</th>
                <th className="px-4 py-3">Prioridade</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {demandas.map((d: DemandaApp) => (
                <tr key={d.id} className="border-t">
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(d.created_at)}</td>
                  <td className="max-w-xs truncate px-4 py-3">{d.descricao}</td>
                  <td className="px-4 py-3">{d.motorista_nome ?? "—"}</td>
                  <td className="px-4 py-3">{d.destino ?? "—"}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{d.prioridade}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_CLASS[d.status]}>
                      {STATUS_LABEL[d.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
              {demandas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma demanda encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
