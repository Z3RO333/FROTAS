import Link from "next/link";
import { AlertTriangle, Fuel, Gauge, MapPin, Plus, Truck, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReparoStatusForm } from "@/components/reparos-frota/reparo-status-form";
import { listReparosFrota, reparosFrotaDashboardKpis, type ReparoFrotaRow } from "@/lib/repos/reparos-frota";
import { requireReparoFrotaUser } from "@/lib/rbac";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  ABERTA: "border-slate-200 bg-slate-50 text-slate-800",
  EM_ANDAMENTO: "border-blue-200 bg-blue-50 text-blue-800",
  CONCLUIDA: "border-green-200 bg-green-50 text-green-800",
  CANCELADA: "border-red-200 bg-red-50 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const PRIORIDADE_COLORS: Record<string, string> = {
  NORMAL: "border-emerald-200 bg-emerald-50 text-emerald-800",
  URGENTE: "border-amber-200 bg-amber-50 text-amber-800",
  ALTA: "border-red-200 bg-red-50 text-red-800",
};

export default async function ReparosFrotaAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireReparoFrotaUser();
  const { status: filtroStatus } = await searchParams;

  const [kpis, rows] = await Promise.all([reparosFrotaDashboardKpis(), listReparosFrota(200)]);
  const filteredRows = filtroStatus && filtroStatus !== "todos"
    ? rows.filter((row) => row.status === filtroStatus)
    : rows;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Manutenção</p>
          <h1 className="text-3xl font-semibold tracking-tight">Reparo de Frota</h1>
        </div>
        <Button asChild>
          <Link href="/reparos-frota/novo">
            <Plus className="h-4 w-4" aria-hidden="true" /> Nova solicitação
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Total" value={kpis.total} icon={<Wrench className="h-4 w-4" />} />
        <Kpi title="Abertas" value={kpis.abertas} icon={<AlertTriangle className="h-4 w-4" />} accent="amber" />
        <Kpi title="Prioridade alta em aberto" value={kpis.prioridade_alta} icon={<AlertTriangle className="h-4 w-4" />} accent="red" />
        <Kpi title="Concluídas" value={kpis.concluidas} icon={<Wrench className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { value: "todos", label: "Todas" },
          { value: "ABERTA", label: "Abertas" },
          { value: "EM_ANDAMENTO", label: "Em andamento" },
          { value: "CONCLUIDA", label: "Concluídas" },
          { value: "CANCELADA", label: "Canceladas" },
        ].map((opt) => {
          const active = (filtroStatus ?? "todos") === opt.value;
          return (
            <Link
              key={opt.value}
              href={opt.value === "todos" ? "/reparos-frota" : `/reparos-frota?status=${opt.value}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4">
        {filteredRows.length > 0 ? (
          filteredRows.map((reparo) => <ReparoCard key={reparo.id} reparo={reparo} />)
        ) : (
          <div className="rounded-md border bg-white p-6 text-sm text-muted-foreground">
            Nenhuma solicitação de reparo encontrada.
          </div>
        )}
      </div>
    </div>
  );
}

function ReparoCard({ reparo }: { reparo: ReparoFrotaRow }) {
  return (
    <article className="rounded-md border bg-white p-4 shadow-sm">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{reparo.ticket_number}</h2>
          <Badge variant="outline" className={STATUS_COLORS[reparo.status] ?? ""}>
            {STATUS_LABELS[reparo.status] ?? reparo.status}
          </Badge>
          <Badge variant="outline" className={PRIORIDADE_COLORS[reparo.prioridade] ?? ""}>
            Prioridade {reparo.prioridade}
          </Badge>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
            Frota {reparo.frota_carregada ? "carregada" : "vazia"}
          </Badge>
        </div>

        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<Truck className="h-4 w-4" />} value={`${reparo.numero_frota ?? "-"} / ${reparo.placa ?? "-"}`} />
          <Metric icon={<Gauge className="h-4 w-4" />} value={`${formatNumber(reparo.km)} km`} />
          {reparo.litros != null ? (
            <Metric icon={<Fuel className="h-4 w-4" />} value={`${reparo.litros} L`} />
          ) : null}
          <Metric icon={<MapPin className="h-4 w-4" />} value={reparo.localizacao} />
        </div>

        <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-800">
          <p className="font-medium text-slate-600">Motivo da verificação</p>
          <p className="mt-1 whitespace-pre-wrap">{reparo.motivo_verificacao}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Info label="Solicitante" value={reparo.solicitante_nome ?? reparo.solicitante_id} />
          <Info label="Criado em" value={formatDate(reparo.criado_em)} />
          <Info label="Responsável" value={reparo.responsavel_atendimento ?? "Nenhum"} />
        </div>

        <ReparoStatusForm reparoId={reparo.id} currentStatus={reparo.status} />
      </div>
    </article>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-amber-700">{icon}</span>
      <span className="truncate">{value}</span>
    </span>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-slate-50 p-3 text-sm">
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="mt-1 block">{value}</span>
    </div>
  );
}

function Kpi({ title, value, icon, accent }: { title: string; value: number; icon: React.ReactNode; accent?: "amber" | "red" }) {
  return (
    <Card className="rounded-md">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className={accent === "amber" ? "text-amber-600" : accent === "red" ? "text-red-700" : "text-slate-600"}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{formatNumber(value)}</div>
      </CardContent>
    </Card>
  );
}
