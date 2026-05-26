import Link from "next/link";
import { AlertTriangle, CalendarClock, Camera, MapPin, Plus, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listDriverSinistros } from "@/lib/repos/sinistros";
import { requireAppUser } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MeusSinistrosPage({
  searchParams,
}: {
  searchParams?: Promise<{ ticket?: string }>;
}) {
  const user = await requireAppUser();
  const rows = await listDriverSinistros(user.email, 50);
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-700">Motorista</p>
          <h1 className="text-3xl font-semibold tracking-tight">Meus sinistros</h1>
        </div>
        <Button asChild>
          <Link href="/motorista/sinistro">
            <Plus className="h-4 w-4" />
            Novo sinistro
          </Link>
        </Button>
      </div>

      {params?.ticket ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Sinistro enviado com sucesso. Protocolo: <strong>{params.ticket}</strong>
        </div>
      ) : null}

      <div className="grid gap-3">
        {rows.length > 0 ? (
          rows.map((sinistro) => (
            <article key={sinistro.id} className="rounded-md border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{sinistro.ticket_number}</h2>
                    <Badge variant="outline">{sinistro.tipo_sinistro === "casa" ? "CASA" : "VEICULO"}</Badge>
                    <Badge variant="outline">{sinistro.status}</Badge>
                    {sinistro.houve_feridos ? (
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">
                        Com feridos
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-700">{sinistro.descricao}</p>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                    <Metric icon={<Truck className="h-4 w-4" />} value={`${sinistro.numero_frota ?? "-"} / ${sinistro.placa ?? "-"}`} />
                    <Metric icon={<CalendarClock className="h-4 w-4" />} value={formatDate(sinistro.criado_em)} />
                    <Metric icon={<MapPin className="h-4 w-4" />} value={sinistro.endereco} />
                    <Metric icon={<Camera className="h-4 w-4" />} value={`${sinistro.media_paths?.length ?? 0} foto(s)`} />
                  </div>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="flex items-start gap-3 rounded-md border bg-white p-6 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-slate-400" aria-hidden="true" />
            Nenhum sinistro registrado.
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-blue-700">{icon}</span>
      <span className="truncate">{value}</span>
    </span>
  );
}
