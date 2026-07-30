import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Eye, Gauge, MapPin, ShieldCheck, Truck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChecklistFilters } from "@/components/checklists/checklist-filters";
import {
  checklistDashboardKpis,
  listAdminChecklists,
  listChecklistRoutes,
  listOpenPendencias,
  periodoParaDatas,
} from "@/lib/repos/checklists";
import { countChecklistImageInspectionsByStatus } from "@/lib/repos/checklist-images";
import { requireAdminUser } from "@/lib/rbac";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ChecklistsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminUser();
  const sp = await searchParams;
  const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
  const filtroData = sp.dataInicio || sp.dataFim
    ? {
        dataInicio: sp.dataInicio && DATA_RE.test(sp.dataInicio) ? sp.dataInicio : undefined,
        dataFim: sp.dataFim && DATA_RE.test(sp.dataFim) ? sp.dataFim : undefined,
      }
    : periodoParaDatas(sp.periodo);

  const filtros = { ...filtroData, rota: sp.rota?.trim() || undefined };
  const [kpis, checklists, pendencias, vision, routes] = await Promise.all([
    checklistDashboardKpis(),
    listAdminChecklists(100, filtros),
    listOpenPendencias(5),
    countChecklistImageInspectionsByStatus(),
    listChecklistRoutes(),
  ]);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 sm:text-sm">Administração</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Checklists de frotas</h1>
        <p className="text-sm text-muted-foreground">Acompanhe vistorias, pendências e divergências por período e rota.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi title="Hoje" value={kpis.total_hoje} icon={<ClipboardCheck className="h-4 w-4" />} />
        <Kpi title="Aprovados" value={kpis.aprovados_hoje} icon={<ShieldCheck className="h-4 w-4" />} />
        <Kpi title="Pendências" value={kpis.pendentes_hoje} icon={<AlertTriangle className="h-4 w-4" />} />
        <Kpi title="Críticas abertas" value={kpis.criticos_abertos} icon={<AlertTriangle className="h-4 w-4" />} />
        <Link href="/checklists/validacao-km" className="rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
          <Kpi title="Divergências KM" value={kpis.divergencias_km} icon={<Gauge className="h-4 w-4" />} />
        </Link>
        <Kpi title="Visão IA na fila" value={vision.queued + vision.processing} icon={<Eye className="h-4 w-4" />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-md border bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-4 py-3 font-semibold">Registros recentes</div>
          <div className="p-3">
            <ChecklistFilters routes={routes} />
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Frota</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Rota</th>
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
                    <td className="max-w-52 truncate px-4 py-3" title={checklist.rota ?? undefined}>{checklist.rota ?? "-"}</td>
                    <td className="px-4 py-3">{checklist.motorista_nome ?? checklist.motorista_id}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(checklist.km_informado)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{checklist.status_geral}</Badge>
                    </td>
                  </tr>
                ))}
                {checklists.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum checklist encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-3 pt-0 md:hidden">
            {checklists.map((checklist) => (
              <article key={checklist.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{formatDate(checklist.data_checklist)}</p>
                    <h2 className="mt-0.5 truncate text-lg font-semibold">
                      Frota {checklist.frota_geral ?? checklist.placa ?? checklist.frota_id}
                    </h2>
                  </div>
                  <Badge variant="outline" className="max-w-[45%] shrink-0 truncate">
                    {checklist.status_geral}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <MobileInfo icon={<Truck />} label="Placa" value={checklist.placa ?? "-"} />
                  <MobileInfo icon={<Gauge />} label="KM" value={formatNumber(checklist.km_informado)} />
                  <MobileInfo icon={<MapPin />} label="Rota" value={checklist.rota ?? "Não informada"} />
                  <MobileInfo
                    icon={<UserRound />}
                    label="Motorista"
                    value={checklist.motorista_nome ?? checklist.motorista_id}
                  />
                </div>
              </article>
            ))}
            {checklists.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-slate-50 p-6 text-center text-sm text-muted-foreground">
                Nenhum checklist encontrado para os filtros selecionados.
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pendências recentes</h2>
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
            <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground">Sem pendências abertas.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="min-w-0 rounded-xl">
      <CardHeader className="flex-row items-start justify-between space-y-0 p-3 pb-1 sm:p-4 sm:pb-2">
        <CardTitle className="min-w-0 text-xs font-medium leading-4 text-muted-foreground sm:text-sm">{title}</CardTitle>
        <span className="text-blue-700">{icon}</span>
      </CardHeader>
      <CardContent className="p-3 pt-1 sm:p-4 sm:pt-0">
        <div className="text-xl font-semibold tabular-nums sm:text-2xl">{formatNumber(value)}</div>
      </CardContent>
    </Card>
  );
}

function MobileInfo({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0 [&_svg]:text-blue-700">
        {icon}
        {label}
      </div>
      <p className="mt-1 break-words font-medium text-slate-900">{value}</p>
    </div>
  );
}
