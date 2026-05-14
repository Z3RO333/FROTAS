import { CalendarClock, Gauge, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listDriverChecklists } from "@/lib/repos/checklists";
import { requireAppUser } from "@/lib/rbac";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_CLASS: Record<string, string> = {
  APROVADO: "border-emerald-200 bg-emerald-50 text-emerald-800",
  COM_OBSERVACAO: "border-amber-200 bg-amber-50 text-amber-800",
  NAO_APTO: "border-orange-200 bg-orange-50 text-orange-800",
  CRITICO: "border-red-200 bg-red-50 text-red-800",
};

export default async function MeusChecklistsPage() {
  const user = await requireAppUser();
  const rows = await listDriverChecklists(user.email, 50);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Motorista</p>
        <h1 className="text-3xl font-semibold tracking-tight">Meus checklists</h1>
      </div>

      <div className="grid gap-3">
        {rows.length > 0 ? (
          rows.map((checklist) => (
            <article key={checklist.id} className="rounded-md border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {formatDate(checklist.data_checklist)} - {checklist.frota_geral ?? checklist.placa ?? "Frota"}
                  </h2>
                  <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                    <Metric icon={<Truck className="h-4 w-4" />} value={checklist.modelo ?? "Modelo não informado"} />
                    <Metric icon={<Gauge className="h-4 w-4" />} value={`KM ${formatNumber(checklist.km_informado)}`} />
                    <Metric icon={<CalendarClock className="h-4 w-4" />} value={checklist.criado_em ?? "-"} />
                  </div>
                </div>
                <Badge variant="outline" className={STATUS_CLASS[checklist.status_geral] ?? ""}>
                  {checklist.status_geral}
                </Badge>
              </div>
              {checklist.observacao_corrigida_ia ? (
                <p className="mt-3 rounded-md border bg-slate-50 p-3 text-sm">{checklist.observacao_corrigida_ia}</p>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-md border bg-white p-6 text-sm text-muted-foreground">
            Você ainda não possui checklists registrados.
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-blue-700">{icon}</span>
      {value}
    </span>
  );
}
