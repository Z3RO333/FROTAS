import { FileText } from "lucide-react";
import { requireAppUser } from "@/lib/rbac";
import { getCustosPorPeriodo, getCustosTotais } from "@/lib/repos/custos";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function OrdensPage() {
  await requireAppUser();
  const [periodos, totais] = await Promise.all([
    getCustosPorPeriodo(12),
    getCustosTotais(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Manutenção"
        title="Ordens de manutenção"
        description="Últimos 12 períodos."
        icon={FileText}
        severity="INFO"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total de ordens (12 meses)</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{totais.qtd_ordens.toLocaleString("pt-BR")}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Valor total</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">
            R$ {totais.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b">
              <th className="p-3 text-left font-medium text-muted-foreground">Período</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Qtd. ordens</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((o) => (
              <tr key={o.data_periodo} className="border-b odd:bg-white even:bg-slate-50/60 last:border-0">
                <td className="p-3 font-medium">{o.data_periodo}</td>
                <td className="p-3 text-right tabular-nums">{o.qtd_ordens.toLocaleString("pt-BR")}</td>
                <td className="p-3 text-right tabular-nums">
                  R$ {o.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {periodos.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Nenhum dado disponível.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
