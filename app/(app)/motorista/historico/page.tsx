import Link from "next/link";
import { History } from "lucide-react";
import { requireAppUser } from "@/lib/rbac";
import { getFrotasDoMotorista, getChecklistStatsMotorista } from "@/lib/repos/motoristas";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MotoristaHistoricoPage() {
  const user = await requireAppUser();
  const [frotas, stats] = await Promise.all([
    getFrotasDoMotorista(user.email),
    getChecklistStatsMotorista(user.email),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        eyebrow="Motorista"
        title="Meu histórico"
        description="Resumo das suas movimentações e checklists."
        icon={History}
        severity="INFO"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Checklists", value: stats.total_checklists },
          { label: "KM registrado", value: formatNumber(stats.km_total) },
          { label: "Frotas distintas", value: stats.frotas_distintas },
          {
            label: "Último checklist",
            value: stats.ultimo_checklist ? formatDate(stats.ultimo_checklist) : "—",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Frotas que já levei</h2>
        {frotas.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-center text-sm text-muted-foreground">
            Nenhuma movimentação registrada ainda.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b">
                  <th className="p-3 text-left font-medium text-muted-foreground">Frota</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Placa</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Movimentações</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Última vez</th>
                </tr>
              </thead>
              <tbody>
                {frotas.map((f) => (
                  <tr
                    key={f.frota_id}
                    className="border-b odd:bg-white even:bg-slate-50/60 last:border-0"
                  >
                    <td className="p-3 font-medium">
                      <Link href={`/frotas/${f.frota_id}`} className="hover:text-blue-600 hover:underline">
                        {f.frota_geral ?? String(f.frota_id)}
                      </Link>
                    </td>
                    <td className="p-3">{f.placa ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{f.qtd_movimentacoes}</td>
                    <td className="p-3 text-right">{f.ultima_vez ? formatDate(f.ultima_vez) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
