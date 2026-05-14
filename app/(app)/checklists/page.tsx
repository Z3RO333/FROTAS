import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Gauge, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  checklistDashboardKpis,
  listAdminChecklists,
  listOpenPendencias,
} from "@/lib/repos/checklists";
import { requireAdminUser } from "@/lib/rbac";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ChecklistsAdminPage() {
  await requireAdminUser();
  const [kpis, checklists, pendencias] = await Promise.all([
    checklistDashboardKpis(),
    listAdminChecklists(100),
    listOpenPendencias(5),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Administracao</p>
        <h1 className="text-3xl font-semibold tracking-tight">Checklists de frotas</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Kpi title="Hoje" value={kpis.total_hoje} icon={<ClipboardCheck className="h-4 w-4" />} />
        <Kpi title="Aprovados" value={kpis.aprovados_hoje} icon={<ShieldCheck className="h-4 w-4" />} />
        <Kpi title="Pendencias" value={kpis.pendentes_hoje} icon={<AlertTriangle className="h-4 w-4" />} />
        <Kpi title="Criticas abertas" value={kpis.criticos_abertos} icon={<AlertTriangle className="h-4 w-4" />} />
        <Link href="/checklists/validacao-km" className="rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
          <Kpi title="Divergencias KM" value={kpis.divergencias_km} icon={<Gauge className="h-4 w-4" />} />
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-md border bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-4 py-3 font-semibold">Registros recentes</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Frota</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3 text-right">KM</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {checklists.map((checklist) => (
                  <tr key={checklist.id} className="border-t">
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(checklist.data_checklist)}</td>
                    <td className="px-4 py-3 font-medium">{checklist.frota_geral ?? "-"}</td>
                    <td className="px-4 py-3">{checklist.placa ?? "-"}</td>
                    <td className="px-4 py-3">{checklist.motorista_nome ?? checklist.motorista_id}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(checklist.km_informado)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{checklist.status_geral}</Badge>
                    </td>
                  </tr>
                ))}
                {checklists.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum checklist encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pendencias recentes</h2>
          {pendencias.length > 0 ? (
            pendencias.map((pendencia) => (
              <article key={pendencia.id} className="rounded-md border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{pendencia.item_nome}</h3>
                    <p className="text-sm text-muted-foreground">
                      {pendencia.frota_geral ?? pendencia.placa ?? "Frota"} - {pendencia.motorista_nome ?? pendencia.motorista_id}
                    </p>
                  </div>
                  <Badge variant="outline">{pendencia.gravidade}</Badge>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground">Sem pendencias abertas.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="rounded-md">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-blue-700">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{formatNumber(value)}</div>
      </CardContent>
    </Card>
  );
}
