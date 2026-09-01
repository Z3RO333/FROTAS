import { Fragment } from "react";
import { AlertTriangle, ClipboardCheck, Eye, Gauge, MapPin, Percent, ShieldCheck, Truck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChecklistFilters } from "@/components/checklists/checklist-filters";
import {
  checklistDashboardKpis,
  checklistLocationKpis,
  listChecklistIdsForFilters,
  listAdminChecklists,
  listOpenPendencias,
  periodoParaDatas,
} from "@/lib/repos/checklists";
import { countChecklistImageInspectionsByStatus } from "@/lib/repos/checklist-images";
import { setoresDistintos } from "@/lib/repos/frotas";
import { CDS_OPERACIONAIS } from "@/lib/cds";
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

  const filtros = {
    ...filtroData,
    veiculo: sp.veiculo?.trim() || undefined,
    localizacao: sp.localizacao?.trim() || undefined,
    setor: sp.setor?.trim() || undefined,
  };
  const temFiltro = Object.values(filtros).some(Boolean);
  const temFiltroLocal = Boolean(filtros.localizacao || filtros.setor);
  const visionPromise = temFiltro
    ? listChecklistIdsForFilters(filtros).then((ids) => countChecklistImageInspectionsByStatus(ids))
    : countChecklistImageInspectionsByStatus();
  const [kpis, checklists, pendencias, vision, setores, localKpis] = await Promise.all([
    checklistDashboardKpis(filtros),
    listAdminChecklists(100, filtros),
    listOpenPendencias(5, filtros),
    visionPromise,
    setoresDistintos(),
    temFiltroLocal ? checklistLocationKpis(filtros) : Promise.resolve(null),
  ]);
  const localizacoes: string[] = [...CDS_OPERACIONAIS];
  const checklistGroups = groupChecklistsByDate(checklists);
  const periodoSelecionado = Boolean(filtros.dataInicio || filtros.dataFim);
  const totalKpiTitle = periodoSelecionado && sp.periodo !== "hoje" ? "No período" : "Hoje";
  const checklistLocalTitle = periodoSelecionado && sp.periodo !== "hoje" ? "Com checklist" : "Com checklist hoje";
  const escopoLocal = [filtros.localizacao, filtros.setor].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 sm:text-sm">Administração</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Checklists de Frotas</h1>
        <p className="text-sm text-muted-foreground">Acompanhe vistorias, pendências e divergências por período, frota ou placa.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi title={totalKpiTitle} value={kpis.total_hoje} icon={<ClipboardCheck className="h-4 w-4" />} />
        <Kpi title="Aprovados" value={kpis.aprovados_hoje} icon={<ShieldCheck className="h-4 w-4" />} />
        <Kpi title="Pendências" value={kpis.pendentes_hoje} icon={<AlertTriangle className="h-4 w-4" />} />
        <Kpi title="Críticas abertas" value={kpis.criticos_abertos} icon={<AlertTriangle className="h-4 w-4" />} />
        <Kpi title="Visão IA na fila" value={vision.queued + vision.processing} icon={<Eye className="h-4 w-4" />} />
      </div>

      {localKpis ? (
        <section className="space-y-2" aria-label={`Resumo de ${escopoLocal}`}>
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500" title={escopoLocal}>
            Resumo do local · {escopoLocal}
          </p>
          <div className="grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
            <CompactKpi title="Total de frotas" value={formatNumber(localKpis.total_frotas)} icon={<Truck />} />
            <CompactKpi
              title={checklistLocalTitle}
              value={formatNumber(localKpis.frotas_com_checklist)}
              icon={<ClipboardCheck />}
            />
            <CompactKpi title="Percentual" value={`${localKpis.percentual_checklist}%`} icon={<Percent />} />
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-md border bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-4 py-3 font-semibold">Registros recentes</div>
          <div className="p-3">
            <ChecklistFilters localizacoes={localizacoes} setores={setores} />
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Frota</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Setor</th>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3 text-right">KM</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Observações</th>
                </tr>
              </thead>
              <tbody>
                {checklistGroups.map((group) => (
                  <Fragment key={group.date}>
                    <tr className="border-t bg-slate-100">
                      <td colSpan={8} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {group.date} · {group.items.length} {group.items.length === 1 ? "checklist" : "checklists"}
                      </td>
                    </tr>
                    {group.items.map((checklist) => {
                      const observacao =
                        checklist.observacao_corrigida_ia?.trim() || checklist.observacao_original?.trim() || "";

                      return (
                        <tr key={checklist.id} className="border-t align-top">
                          <td className="whitespace-nowrap px-4 py-3">{formatDate(checklist.data_checklist)}</td>
                          <td className="px-4 py-3 font-medium">{checklist.frota_geral ?? "-"}</td>
                          <td className="px-4 py-3">{checklist.placa ?? "-"}</td>
                          <td className="max-w-52 truncate px-4 py-3" title={checklist.rota ?? undefined}>{checklist.rota ?? "-"}</td>
                          <td className="px-4 py-3">{checklist.motorista_nome ?? checklist.motorista_id}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(checklist.km_informado)}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{checklist.status_geral}</Badge>
                          </td>
                          <td className="min-w-56 max-w-80 whitespace-pre-wrap break-words px-4 py-3">
                            {observacao ?? ""}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
                {checklists.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum checklist encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 p-3 pt-0 md:hidden">
            {checklistGroups.map((group) => (
              <div key={group.date} className="space-y-3">
                <div className="sticky top-0 z-10 -mx-3 bg-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {group.date} · {group.items.length} {group.items.length === 1 ? "checklist" : "checklists"}
                </div>
                {group.items.map((checklist) => {
                  const observacao =
                    checklist.observacao_corrigida_ia?.trim() || checklist.observacao_original?.trim() || "";

                  return (
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
                        <MobileInfo icon={<MapPin />} label="Setor" value={checklist.rota ?? "Não informado"} />
                        <MobileInfo
                          icon={<UserRound />}
                          label="Motorista"
                          value={checklist.motorista_nome ?? checklist.motorista_id}
                        />
                      </div>
                      {observacao ? (
                        <div className="mt-3 border-t pt-3 text-sm">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Observações</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-slate-900">{observacao}</p>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
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

type Checklist = Awaited<ReturnType<typeof listAdminChecklists>>[number];

// Checklists já vêm ordenados por data (mais recente primeiro); agrupar aqui só
// junta itens consecutivos do mesmo dia pra desenhar um separador entre os dias.
function groupChecklistsByDate(checklists: Checklist[]): { date: string; items: Checklist[] }[] {
  const groups: { date: string; items: Checklist[] }[] = [];
  for (const checklist of checklists) {
    const date = formatDate(checklist.data_checklist);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.date === date) {
      lastGroup.items.push(checklist);
    } else {
      groups.push({ date, items: [checklist] });
    }
  }
  return groups;
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

function CompactKpi({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="min-w-0 rounded-lg border-blue-100 bg-blue-50/40 shadow-sm">
      <CardContent className="flex min-h-20 items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium leading-4 text-muted-foreground sm:text-xs">{title}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950 sm:text-xl">{value}</p>
        </div>
        <span className="shrink-0 text-blue-700 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
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
