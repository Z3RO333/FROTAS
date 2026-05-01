import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HistoricoEntry } from "@/lib/repos/historico";
import { formatDate } from "@/lib/utils";

export function HistoricoTimeline({ entries }: { entries: HistoricoEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historico de alteracoes</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem alteracoes registradas.</p>
        ) : (
          <ul className="space-y-4">
            {entries.map((h) => (
              <li key={h.id} className="border-l-2 border-primary/30 pl-4">
                <div className="text-xs text-muted-foreground">
                  {formatDate(h.alterado_em)} · {h.alterado_por}
                </div>
                <div className="mt-1 text-sm">
                  <strong>{h.campo}</strong>: {h.valor_antigo || "—"} →{" "}
                  <strong>{h.valor_novo || "—"}</strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
