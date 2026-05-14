import { getParadas } from "@/lib/repos/planejamento";

export const dynamic = "force-dynamic";

const CRIT_COLOR: Record<string, string> = {
  CRITICA: "bg-red-200 text-red-900 font-bold",
  ALTA: "bg-red-100 text-red-800",
  MEDIA: "bg-amber-100 text-amber-800",
  BAIXA: "bg-blue-50 text-blue-700",
};

const CRIT_CARD: Record<string, string> = {
  CRITICA: "bg-red-50 border-red-300 text-red-900",
  ALTA: "bg-red-50 border-red-200 text-red-800",
  MEDIA: "bg-amber-50 border-amber-200 text-amber-800",
  BAIXA: "bg-blue-50 border-blue-200 text-blue-800",
};

function CritBadge({ crit }: { crit: string | null }) {
  if (!crit) return <span className="rounded px-2 py-0.5 text-xs bg-slate-100 text-slate-600">Não analisado</span>;
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${CRIT_COLOR[crit] ?? "bg-slate-100 text-slate-700"}`}>{crit}</span>;
}

export default async function ParadasPage() {
  const rows = await getParadas();

  const byCrit = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.ia_criticidade ?? "NAO_ANALISADO";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const analisadas = rows.filter((r) => r.ia_analisado_em != null).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["CRITICA", "ALTA", "MEDIA", "BAIXA"] as const).map((c) => (
          <div key={c} className={`rounded-md border p-4 ${CRIT_CARD[c]}`}>
            <div className="text-2xl font-bold">{byCrit[c] ?? 0}</div>
            <div className="mt-1 text-xs font-medium">{c}</div>
          </div>
        ))}
        <div className="rounded-md border bg-slate-50 border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-700">{analisadas}</div>
          <div className="mt-1 text-xs font-medium text-slate-600">Analisadas pela IA</div>
        </div>
      </div>

      {analisadas < rows.length && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {rows.length - analisadas} frotas ainda não foram analisadas pela IA.
          Rode: <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">npx tsx scripts/import-planejamento/11-ia-frotas-paradas.ts</code>
        </div>
      )}

      <div className="overflow-hidden rounded-md border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Frotas paradas ({rows.length})</h2>
        </div>
        <div className="divide-y">
          {rows.map((r) => (
            <div key={r.id} className="p-4 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">
                      {r.frota_numero ? `Frota ${r.frota_numero}` : r.placa ?? "—"}
                    </span>
                    {r.setor && <span className="text-xs text-muted-foreground">{r.setor}</span>}
                    {r.oficina && <span className="text-xs text-muted-foreground">· {r.oficina}</span>}
                  </div>
                  <p className="text-sm text-slate-800">{r.descricao_original}</p>
                  {r.ia_texto_corrigido && r.ia_texto_corrigido !== r.descricao_original && (
                    <p className="text-sm text-blue-700 italic">IA: {r.ia_texto_corrigido}</p>
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
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <CritBadge crit={r.ia_criticidade} />
                  {r.ia_classificacao && (
                    <span className="rounded px-2 py-0.5 text-xs bg-slate-100 text-slate-600">{r.ia_classificacao}</span>
                  )}
                </div>
              </div>
              {(r.inicio_em || r.prev_saida) && (
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  {r.inicio_em && <span>Entrada: {r.inicio_em}</span>}
                  {r.prev_saida && <span>Prev. saída: {r.prev_saida}</span>}
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma frota parada registrada. Rode o script de importação.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
