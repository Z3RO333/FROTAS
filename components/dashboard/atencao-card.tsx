import Link from "next/link";
import { AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PontoAtencao } from "@/lib/repos/disponibilidade";

export function AtencaoSection({ pontos }: { pontos: PontoAtencao[] }) {
  if (pontos.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
        Outros pontos de atenção
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {pontos.map((p, i) => (
          <AtencaoCard key={i} ponto={p} />
        ))}
      </div>
    </div>
  );
}

function AtencaoCard({ ponto }: { ponto: PontoAtencao }) {
  const critico = ponto.severidade === "CRITICO";
  return (
    <Link
      href={`/frotas/${ponto.frota_id}`}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-slate-50",
        critico ? "border-red-200 bg-red-50/50" : "border-amber-200 bg-amber-50/50"
      )}
    >
      {critico ? (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{ponto.titulo}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{ponto.descricao}</p>
        {ponto.placa && (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">{ponto.placa}</p>
        )}
      </div>
    </Link>
  );
}
