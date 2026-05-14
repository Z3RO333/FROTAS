import { AlertTriangle, CheckCircle2, Clock3, DoorOpen, LogIn, LogOut, Search } from "lucide-react";
import { registrarMovimentacaoPortariaAction } from "@/app/(app)/portaria/_actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listPortariaToday, type PortariaRow, type StatusPortaria } from "@/lib/repos/checklists";
import { requirePortariaUser } from "@/lib/rbac";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<StatusPortaria, string> = {
  PENDENTE_CHECKLIST: "Pendente",
  CHECKLIST_REALIZADO: "Com observação",
  LIBERADA_SAIDA: "Liberada",
  BLOQUEADA_CHECKLIST: "Bloqueada",
  BLOQUEADA_MANUTENCAO: "Em manutenção",
  SAIDA_REGISTRADA: "Saída registrada",
  ENTRADA_REGISTRADA: "Entrada registrada",
};

const STATUS_CLASS: Record<StatusPortaria, string> = {
  PENDENTE_CHECKLIST: "border-slate-200 bg-slate-100 text-slate-800",
  CHECKLIST_REALIZADO: "border-amber-200 bg-amber-50 text-amber-800",
  LIBERADA_SAIDA: "border-emerald-200 bg-emerald-50 text-emerald-800",
  BLOQUEADA_CHECKLIST: "border-red-200 bg-red-50 text-red-800",
  BLOQUEADA_MANUTENCAO: "border-violet-300 bg-violet-50 text-violet-800",
  SAIDA_REGISTRADA: "border-blue-200 bg-blue-50 text-blue-800",
  ENTRADA_REGISTRADA: "border-violet-200 bg-violet-50 text-violet-800",
};

export default async function PortariaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePortariaUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = await listPortariaToday();
  const filtered = q ? rows.filter((row) => matchesSearch(row, q)) : rows;
  const kpis = {
    checklistsHoje: rows.filter((row) => row.checklist_id).length,
    liberadas: rows.filter((row) => row.status_portaria === "LIBERADA_SAIDA").length,
    bloqueadas:
      rows.filter((row) => row.status_portaria === "BLOQUEADA_CHECKLIST").length +
      rows.filter((row) => row.status_portaria === "BLOQUEADA_MANUTENCAO").length,
    pendentes: rows.filter((row) => row.status_portaria === "PENDENTE_CHECKLIST").length,
    emManutencao: rows.filter((row) => row.status_portaria === "BLOQUEADA_MANUTENCAO").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Portaria</p>
        <h1 className="text-3xl font-semibold tracking-tight">Liberação de frotas</h1>
        <p className="text-sm text-muted-foreground">Data: {formatDate(new Date())}</p>
      </div>

      <form className="grid gap-2 rounded-md border bg-white p-3 shadow-sm sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Placa, frota ou motorista" className="pl-9" />
        </div>
        <Button type="submit">
          <Search className="h-4 w-4" aria-hidden="true" />
          Buscar
        </Button>
      </form>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Checklist realizados hoje" value={kpis.checklistsHoje} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Kpi title="Frotas liberadas" value={kpis.liberadas} icon={<DoorOpen className="h-4 w-4" />} />
        <Kpi title="Frotas bloqueadas" value={kpis.bloqueadas} icon={<AlertTriangle className="h-4 w-4" />} />
        <Kpi title="Pendentes de checklist" value={kpis.pendentes} icon={<Clock3 className="h-4 w-4" />} />
      </div>

      <div className="grid gap-3 lg:hidden">
        {filtered.map((row) => (
          <PortariaCard key={row.frota_id} row={row} />
        ))}
      </div>

      <section className="hidden overflow-hidden rounded-md border bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Horário</th>
                <th className="px-4 py-3">Frota</th>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Checklist</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.frota_id} className="border-t align-top">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatTime(row.data_checklist)}</td>
                  <td className="px-4 py-3 font-medium">{row.frota_geral ?? `#${row.frota_id}`}</td>
                  <td className="px-4 py-3">{row.placa ?? "-"}</td>
                  <td className="px-4 py-3">{row.motorista_nome ?? row.motorista_id ?? "-"}</td>
                  <td className="px-4 py-3">{row.checklist_id ? "Feito" : "Pendente"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status_portaria} />
                    {row.pendencia_critica_item ? (
                      <div className="mt-1 text-xs text-red-700">Item: {row.pendencia_critica_item}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <MovementAction row={row} />
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma frota encontrada.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PortariaCard({ row }: { row: PortariaRow }) {
  return (
    <article className="rounded-md border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{row.frota_geral ?? `Frota #${row.frota_id}`}</h2>
          <p className="text-sm text-muted-foreground">{row.placa ?? "Sem placa"} - {row.modelo ?? "Sem modelo"}</p>
        </div>
        <StatusBadge status={row.status_portaria} />
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        {row.status_portaria === "BLOQUEADA_MANUTENCAO" ? (
          <div className="rounded-md border border-violet-300 bg-violet-50 p-2.5 text-xs">
            <div className="font-semibold text-violet-900">Frota em manutenção</div>
            {row.manutencao_motivo && (
              <div className="mt-0.5 text-violet-800">{row.manutencao_motivo}</div>
            )}
            {row.manutencao_prev_retorno && (
              <div className="mt-0.5 text-violet-700">
                Prev. retorno: {row.manutencao_prev_retorno}
              </div>
            )}
          </div>
        ) : (
          <>
            <Info label="Motorista" value={row.motorista_nome ?? row.motorista_id ?? "-"} />
            <Info label="Checklist" value={row.checklist_id ? `Hoje às ${formatTime(row.data_checklist)}` : "Pendente"} />
            <Info label="KM" value={formatNumber(row.km_informado)} />
            {row.pendencia_critica_item ? <Info label="Motivo" value={row.pendencia_critica_item} /> : null}
          </>
        )}
      </div>
      <div className="mt-4">
        <MovementAction row={row} />
      </div>
    </article>
  );
}

function MovementAction({ row }: { row: PortariaRow }) {
  if (row.status_portaria === "LIBERADA_SAIDA") {
    return <MovementForm row={row} tipo="SAIDA" label="Registrar saída" icon={<LogOut className="h-4 w-4" />} />;
  }

  if (row.status_portaria === "SAIDA_REGISTRADA") {
    return <MovementForm row={row} tipo="ENTRADA" label="Registrar entrada" icon={<LogIn className="h-4 w-4" />} />;
  }

  return (
    <Button type="button" variant="outline" disabled>
      Não liberar
    </Button>
  );
}

function MovementForm({
  row,
  tipo,
  label,
  icon,
}: {
  row: PortariaRow;
  tipo: "SAIDA" | "ENTRADA";
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <form action={registrarMovimentacaoPortariaAction}>
      <input type="hidden" name="frota_id" value={row.frota_id} />
      <input type="hidden" name="checklist_id" value={row.checklist_id ?? ""} />
      <input type="hidden" name="tipo_movimentacao" value={tipo} />
      <Button type="submit" variant={tipo === "SAIDA" ? "default" : "outline"}>
        {icon}
        {label}
      </Button>
    </form>
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

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: StatusPortaria }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function matchesSearch(row: PortariaRow, q: string): boolean {
  return [
    row.frota_geral,
    row.placa,
    row.modelo,
    row.motorista_nome,
    row.motorista_id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}
