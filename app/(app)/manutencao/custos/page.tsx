import { requireAppUser } from "@/lib/rbac";
import { getCustosPorPeriodo, getCustosTotais } from "@/lib/repos/custos";

export const dynamic = "force-dynamic";

export default async function CustosPage() {
  await requireAppUser();
  const [periodos, totais] = await Promise.all([
    getCustosPorPeriodo(12),
    getCustosTotais(),
  ]);

  const maiorValor = Math.max(...periodos.map((p) => p.valor_total), 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Manutenção</p>
        <h1 className="text-3xl font-semibold tracking-tight">Custos</h1>
        <p className="text-sm text-muted-foreground">Análise financeira — últimos 12 períodos</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total de ordens</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{totais.qtd_ordens.toLocaleString("pt-BR")}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Valor total (12 meses)</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">
            R$ {totais.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Custo por período</h2>
        <div className="space-y-2.5">
          {periodos.map((p) => (
            <div key={p.data_periodo} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                {p.data_periodo}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full bg-blue-400 transition-all"
                  style={{ width: `${(p.valor_total / maiorValor) * 100}%` }}
                />
              </div>
              <span className="w-32 shrink-0 text-right text-xs font-medium tabular-nums">
                R$ {p.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              </span>
              <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {p.qtd_ordens} ord.
              </span>
            </div>
          ))}
          {periodos.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">Nenhum dado disponível.</p>
          )}
        </div>
      </div>
    </div>
  );
}
