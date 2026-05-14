import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listOpenPendencias } from "@/lib/repos/checklists";
import { requireAdminUser } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PendenciasPage() {
  await requireAdminUser();
  const rows = await listOpenPendencias(200);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Administração</p>
        <h1 className="text-3xl font-semibold tracking-tight">Pendências e não conformidades</h1>
      </div>

      <div className="grid gap-3">
        {rows.length > 0 ? (
          rows.map((pendencia) => (
            <article key={pendencia.id} className="rounded-md border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
                    <h2 className="text-lg font-semibold">{pendencia.item_nome}</h2>
                    <Badge variant="outline">{pendencia.gravidade}</Badge>
                    <Badge variant="outline">{pendencia.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Frota: {pendencia.frota_geral ?? pendencia.placa ?? pendencia.frota_id} | Motorista:{" "}
                    {pendencia.motorista_nome ?? pendencia.motorista_id ?? "-"} | Criada em {formatDate(pendencia.criado_em)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled>
                    Liberar frota
                  </Button>
                  <Button variant="outline" disabled>
                    Abrir manutenção
                  </Button>
                  <Button disabled>Resolver</Button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-md border bg-white p-6 text-sm text-muted-foreground">
            Nenhuma pendência aberta.
          </div>
        )}
      </div>
    </div>
  );
}
