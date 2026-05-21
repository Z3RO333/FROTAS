import React from "react";
import Link from "next/link";
import { AlertOctagon, Sparkles } from "lucide-react";
import { getParadas } from "@/lib/repos/planejamento";
import { SeverityBadge } from "@/components/ui/status-badge";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { severityFromStatus } from "@/lib/design/tokens";

export const dynamic = "force-dynamic";

export default async function ParadasPage() {
  const rows = await getParadas();

  const byCrit = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.ia_criticidade ?? "NAO_ANALISADO";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const analisadas = rows.filter((r) => r.ia_analisado_em != null).length;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={AlertOctagon}
        title="Nenhuma frota parada"
        description="Rode o script de importação para carregar a aba STATUS- parados."
      />
    );
  }

  return (
    <div className="space-y-6">
      <MetricGrid cols={5}>
        <MetricCard label="Crítica" value={byCrit.CRITICA ?? 0} severity="CRITICO" />
        <MetricCard label="Alta" value={byCrit.ALTA ?? 0} severity="CRITICO" />
        <MetricCard label="Média" value={byCrit.MEDIA ?? 0} severity="ATENCAO" />
        <MetricCard label="Baixa" value={byCrit.BAIXA ?? 0} severity="INFO" />
        <MetricCard
          label="Analisadas pela IA"
          value={analisadas}
          hint={`${rows.length - analisadas} pendentes`}
          severity="NEUTRO"
          icon={Sparkles}
        />
      </MetricGrid>

      {analisadas < rows.length && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {rows.length - analisadas} frotas ainda não foram analisadas pela IA. Rode:{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-mono">
            npx tsx scripts/import-planejamento/11-ia-frotas-paradas.ts
          </code>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Frotas paradas ({rows.length})</h2>
        </div>
        <div className="divide-y">
          {rows.map((r) => {
            const sev = r.ia_criticidade
              ? severityFromStatus(r.ia_criticidade)
              : "NEUTRO";
            const Wrapper = r.veiculo_id
              ? ({ children }: { children: React.ReactNode }) => (
                  <Link
                    href={`/frotas/${r.veiculo_id}`}
                    className="block p-4 hover:bg-slate-50 transition-colors"
                  >
                    {children}
                  </Link>
                )
              : ({ children }: { children: React.ReactNode }) => (
                  <div className="p-4 hover:bg-slate-50">{children}</div>
                );
            return (
              <Wrapper key={r.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {r.frota_numero ? `Frota ${r.frota_numero}` : r.placa ?? "—"}
                      </span>
                      {r.setor && (
                        <span className="text-xs text-muted-foreground">{r.setor}</span>
                      )}
                      {r.oficina && (
                        <span className="text-xs text-muted-foreground">· {r.oficina}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800">{r.descricao_original}</p>
                    {r.ia_texto_corrigido && r.ia_texto_corrigido !== r.descricao_original && (
                      <p className="text-sm italic text-blue-700">IA: {r.ia_texto_corrigido}</p>
                    )}
                    {r.ia_acao_recomendada && (
                      <p className="text-xs text-slate-600">
                        <span className="font-medium">Ação:</span> {r.ia_acao_recomendada}
                      </p>
                    )}
                    {r.ia_justificativa && (
                      <p className="text-xs text-muted-foreground">{r.ia_justificativa}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {r.ia_criticidade ? (
                      <SeverityBadge severity={sev} label={r.ia_criticidade} />
                    ) : (
                      <SeverityBadge severity="NEUTRO" label="Não analisado" />
                    )}
                    {r.ia_classificacao && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
                        {r.ia_classificacao}
                      </span>
                    )}
                  </div>
                </div>
                {(r.inicio_em || r.prev_saida) && (
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    {r.inicio_em && <span>Entrada: {r.inicio_em}</span>}
                    {r.prev_saida && <span>Prev. saída: {r.prev_saida}</span>}
                  </div>
                )}
              </Wrapper>
            );
          })}
        </div>
      </div>
    </div>
  );
}
