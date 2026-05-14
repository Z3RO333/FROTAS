import type { AlertaRow } from "@/lib/repos/alertas";
import { resolverAlertaAction } from "@/app/(app)/relatorios/checklists/_actions";

const TIPO_BADGE: Record<string, string> = {
  CRITICO: "bg-red-100 text-red-800",
  MANUTENCAO: "bg-orange-100 text-orange-800",
  BLOQUEIO_SUGERIDO: "bg-red-200 text-red-900",
  KM_ANOMALO: "bg-amber-100 text-amber-800",
};

export function AlertasAtivos({ alertas }: { alertas: AlertaRow[] }) {
  if (alertas.length === 0) {
    return (
      <div className="rounded-md border bg-emerald-50 p-4 text-sm text-emerald-800">
        Nenhum alerta aberto no momento.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-white">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Alertas abertos ({alertas.length})</h2>
      </div>
      <div className="divide-y">
        {alertas.map((alerta) => (
          <div key={alerta.id} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${TIPO_BADGE[alerta.tipo] ?? "bg-slate-100 text-slate-700"}`}>
                  {alerta.tipo.replace("_", " ")}
                </span>
                <span className="text-sm font-medium">{alerta.titulo}</span>
              </div>
              {alerta.descricao && <p className="text-xs text-muted-foreground">{alerta.descricao}</p>}
              <p className="text-xs text-muted-foreground">
                Frota {alerta.frota_geral ?? alerta.frota_id} · {alerta.placa ?? "—"} ·{" "}
                {new Date(alerta.criado_em).toLocaleString("pt-BR")}
              </p>
            </div>
            <form action={resolverAlertaAction}>
              <input type="hidden" name="alerta_id" value={alerta.id} />
              <input type="hidden" name="status" value="RESOLVIDO" />
              <button type="submit" className="shrink-0 rounded border px-3 py-1 text-xs hover:bg-slate-50">
                Resolver
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
