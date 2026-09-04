import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Gauge,
  MapPin,
  Percent,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChecklistFilters } from "@/components/checklists/checklist-filters";
import { AdminChecklistsTable } from "@/components/checklists/admin-checklists-table";
import { SeverityBadge, StatusBadge } from "@/components/ui/status-badge";
import {
  checklistDashboardKpis,
  checklistLocationKpis,
  listChecklistIdsForFilters,
  listAdminChecklists,
  listOpenPendencias,
  periodoParaDatas,
  ADMIN_CHECKLISTS_PAGE_SIZE,
  type ChecklistListFilters,
} from "@/lib/repos/checklists";
import type { ChecklistStatusGeral } from "@/lib/checklists/catalog";
import { countChecklistImageInspectionsByStatus } from "@/lib/repos/checklist-images";
import { setoresDistintos } from "@/lib/repos/frotas";
import { CDS_OPERACIONAIS } from "@/lib/cds";
import { requireAdminUser } from "@/lib/rbac";
import { cn, formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CHECKLIST_STATUSES: ChecklistStatusGeral[] = ["APROVADO", "COM_OBSERVACAO", "NAO_APTO", "CRITICO"];

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
  const status = CHECKLIST_STATUSES.includes(sp.status as ChecklistStatusGeral)
    ? (sp.status as ChecklistStatusGeral)
    : undefined;

  const filtros: ChecklistListFilters = {
    ...filtroData,
    veiculo: sp.veiculo?.trim() || undefined,
    localizacao: sp.localizacao?.trim() || undefined,
    setor: sp.setor?.trim() || undefined,
    status,
  };
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * ADMIN_CHECKLISTS_PAGE_SIZE;
  const temFiltro = Object.values(filtros).some(Boolean);
  const temFiltroLocal = Boolean(filtros.localizacao || filtros.setor);
  const visionPromise = temFiltro
    ? listChecklistIdsForFilters(filtros).then((ids) => countChecklistImageInspectionsByStatus(ids))
    : countChecklistImageInspectionsByStatus();
  const [kpis, checklists, pendenciasRaw, vision, setores, localKpis] = await Promise.all([
    checklistDashboardKpis(filtros),
    listAdminChecklists(ADMIN_CHECKLISTS_PAGE_SIZE, filtros, offset),
    listOpenPendencias(15, filtros),
    visionPromise,
    setoresDistintos(),
    temFiltroLocal ? checklistLocationKpis(filtros) : Promise.resolve(null),
  ]);
  const pendencias = dedupePendencias(pendenciasRaw).slice(0, 5);
  const localizacoes: string[] = [...CDS_OPERACIONAIS];
  const checklistGroups = groupChecklistsByDate(checklists);
  const hasNextPage = checklists.length === ADMIN_CHECKLISTS_PAGE_SIZE;
  const periodoSelecionado = Boolean(filtros.dataInicio || filtros.dataFim);
  const totalKpiTitle = periodoSelecionado && sp.periodo !== "hoje" ? "No período" : "Hoje";
  const checklistLocalTitle = periodoSelecionado && sp.periodo !== "hoje" ? "Com checklist" : "Com checklist hoje";
  const escopoLocal = [filtros.localizacao, filtros.setor].filter(Boolean).join(" · ");
  const taxaAprovacao = kpis.total_hoje > 0 ? Math.round((kpis.aprovados_hoje / kpis.total_hoje) * 100) : 0;
  const imagensNaFila = vision.queued + vision.processing;

  return (
    <div className="space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-2xl border border-blue-900/20 bg-gradient-to-r from-slate-950 via-blue-950 to-blue-900 px-5 py-6 text-white shadow-sm sm:px-7">
        <Sparkles className="absolute -right-8 -top-10 h-40 w-40 text-white/[0.04]" aria-hidden="true" />
        <div className="relative flex items-start gap-4">
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-blue-100 ring-1 ring-white/15 sm:flex">
            <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Controle operacional</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Checklists de Frotas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Vistorias, não conformidades e análises visuais em uma única fila de acompanhamento.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Indicadores dos checklists">
        <Kpi
          title={totalKpiTitle}
          value={kpis.total_hoje}
          helper="checklists realizados"
          icon={ClipboardCheck}
          tone="blue"
        />
        <Kpi
          title="Aprovados"
          value={kpis.aprovados_hoje}
          helper={`${taxaAprovacao}% do total`}
          icon={ShieldCheck}
          tone="green"
        />
        <Kpi
          title="Com atenção"
          value={kpis.pendentes_hoje}
          helper="observação ou não apto"
          icon={AlertTriangle}
          tone="amber"
        />
        <Kpi
          title="Críticas abertas"
          value={kpis.criticos_abertos}
          helper="exigem acompanhamento"
          icon={AlertTriangle}
          tone="red"
        />
        <Kpi
          title="Imagens aguardando IA"
          value={imagensNaFila}
          helper={vision.processing > 0 ? `${vision.processing} em processamento` : "fila de análise visual"}
          icon={Eye}
          tone="violet"
          className="col-span-2 md:col-span-1"
        />
      </section>

      {localKpis ? (
        <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4" aria-label={`Resumo de ${escopoLocal}`}>
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <p className="truncate text-xs font-semibold uppercase tracking-[0.15em] text-blue-800" title={escopoLocal}>
              Resumo do local · {escopoLocal}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:max-w-2xl sm:gap-3">
            <CompactKpi title="Total de frotas" value={formatNumber(localKpis.total_frotas)} icon={<Truck />} />
            <CompactKpi title={checklistLocalTitle} value={formatNumber(localKpis.frotas_com_checklist)} icon={<ClipboardCheck />} />
            <CompactKpi title="Cobertura" value={`${localKpis.percentual_checklist}%`} icon={<Percent />} />
          </div>
        </section>
      ) : null}

      <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="font-semibold text-slate-950">Registros de vistoria</h2>
              <p className="text-xs text-muted-foreground">
                {checklists.length > 0 ? `${checklists.length} registros nesta página` : "Nenhum registro no filtro atual"}
              </p>
            </div>
            {status ? <StatusBadge status={status} size="md" /> : null}
          </div>
          <div className="border-b bg-white p-4 sm:p-5">
            <ChecklistFilters localizacoes={localizacoes} setores={setores} />
          </div>
          <AdminChecklistsTable groups={checklistGroups} />
          {(page > 1 || hasNextPage) && (
            <nav aria-label="Paginação dos checklists" className="flex items-center justify-between gap-3 border-t bg-slate-50/70 px-4 py-3 sm:px-5">
              <Button asChild={page > 1} variant="outline" size="sm" disabled={page <= 1}>
                {page > 1 ? (
                  <Link href={buildPageUrl(sp, page - 1)}><ChevronLeft aria-hidden="true" />Anterior</Link>
                ) : (
                  <span><ChevronLeft aria-hidden="true" />Anterior</span>
                )}
              </Button>
              <span className="text-xs font-medium text-slate-500">Página {page}</span>
              <Button asChild={hasNextPage} variant="outline" size="sm" disabled={!hasNextPage}>
                {hasNextPage ? (
                  <Link href={buildPageUrl(sp, page + 1)}>Próxima<ChevronRight aria-hidden="true" /></Link>
                ) : (
                  <span>Próxima<ChevronRight aria-hidden="true" /></span>
                )}
              </Button>
            </nav>
          )}
        </section>

        <aside className="min-w-0 overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b bg-slate-50/80 px-4 py-4">
            <div>
              <h2 className="font-semibold text-slate-950">Pendências recentes</h2>
              <p className="text-xs text-muted-foreground">Itens que exigem atenção</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-blue-700">
              <Link href="/pendencias">Ver todas<ArrowRight aria-hidden="true" /></Link>
            </Button>
          </div>

          {pendencias.length > 0 ? (
            <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-1">
              {pendencias.map((pendencia) => {
                const critica = pendencia.gravidade === "CRITICA";
                const frota = pendencia.frota_geral ?? pendencia.placa ?? String(pendencia.frota_id);
                return (
                  <Link
                    key={pendencia.id}
                    href={`/frotas/${pendencia.frota_id}`}
                    className={cn(
                      "group rounded-lg border border-l-4 bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      critica ? "border-l-red-500" : "border-l-amber-400"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">{pendencia.item_nome}</h3>
                      <SeverityBadge severity={critica ? "CRITICO" : "ATENCAO"} label={critica ? "Crítica" : "Média"} size="sm" />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="inline-flex min-w-0 items-center gap-1 font-medium text-slate-700">
                        <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Frota {frota}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" aria-hidden="true" />
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {pendencia.motorista_nome ?? pendencia.motorista_id ?? "Motorista não informado"}
                    </p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900">Tudo em dia</p>
              <p className="mt-1 text-xs text-muted-foreground">Nenhuma pendência aberta neste filtro.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function buildPageUrl(sp: Record<string, string | undefined>, targetPage: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value && key !== "page") params.set(key, value);
  }
  if (targetPage > 1) params.set("page", String(targetPage));
  const query = params.toString();
  return `/checklists${query ? `?${query}` : ""}`;
}

type Checklist = Awaited<ReturnType<typeof listAdminChecklists>>[number];
type Pendencia = Awaited<ReturnType<typeof listOpenPendencias>>[number];

function groupChecklistsByDate(checklists: Checklist[]): { date: string; items: Checklist[] }[] {
  const groups: { date: string; items: Checklist[] }[] = [];
  for (const checklist of checklists) {
    const date = formatDate(checklist.data_checklist);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.date === date) lastGroup.items.push(checklist);
    else groups.push({ date, items: [checklist] });
  }
  return groups;
}

function dedupePendencias(rows: Pendencia[]): Pendencia[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.frota_id}:${row.item_nome.trim().toLocaleLowerCase("pt-BR")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const KPI_TONES = {
  blue: "border-blue-200 bg-blue-50 text-blue-900",
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-red-200 bg-red-50 text-red-900",
  violet: "border-violet-200 bg-violet-50 text-violet-900",
} as const;

function Kpi({
  title,
  value,
  helper,
  icon: Icon,
  tone,
  className,
}: {
  title: string;
  value: number;
  helper: string;
  icon: typeof Gauge;
  tone: keyof typeof KPI_TONES;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0 rounded-xl shadow-sm", KPI_TONES[tone], className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{title}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{formatNumber(value)}</p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 ring-1 ring-current/10">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-2 truncate text-[11px] opacity-70">{helper}</p>
      </CardContent>
    </Card>
  );
}

function CompactKpi({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-blue-100 bg-white/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-slate-500 sm:text-xs">{title}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950 sm:text-xl">{value}</p>
        </div>
        <span className="shrink-0 text-blue-700 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      </div>
    </div>
  );
}
