import { ClipboardCheck } from "lucide-react";
import { requireAppUser } from "@/lib/rbac";
import { listTacografoPorFrota } from "@/lib/repos/tacografo";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

const STATUS_CLASS = {
  EM_DIA: "border-emerald-200 bg-emerald-50 text-emerald-800",
  PROXIMO_VENCIMENTO: "border-amber-200 bg-amber-50 text-amber-800",
  VENCIDO: "border-red-200 bg-red-50 text-red-800",
  SEM_REGISTRO: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

const STATUS_LABEL = {
  EM_DIA: "Em dia",
  PROXIMO_VENCIMENTO: "Próximo do vencimento",
  VENCIDO: "Vencido",
  SEM_REGISTRO: "Sem registro",
} as const;

export default async function TacografoPage() {
  await requireAppUser();
  const frotas = await listTacografoPorFrota();

  const ordenado = [...frotas].sort((a, b) => {
    const order = { VENCIDO: 0, PROXIMO_VENCIMENTO: 1, SEM_REGISTRO: 2, EM_DIA: 3 };
    return order[a.status] - order[b.status];
  });

  const resumo = {
    vencidos: frotas.filter((f) => f.status === "VENCIDO").length,
    proximos: frotas.filter((f) => f.status === "PROXIMO_VENCIMENTO").length,
    sem_registro: frotas.filter((f) => f.status === "SEM_REGISTRO").length,
    em_dia: frotas.filter((f) => f.status === "EM_DIA").length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Manutenção"
        title="Tacógrafo"
        description={`${frotas.length} frotas monitoradas.`}
        icon={ClipboardCheck}
        severity="ATENCAO"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Vencidos", value: resumo.vencidos, color: "text-red-600" },
          { label: "Próximos", value: resumo.proximos, color: "text-amber-600" },
          { label: "Sem registro", value: resumo.sem_registro, color: "text-slate-500" },
          { label: "Em dia", value: resumo.em_dia, color: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b">
              <th className="p-3 text-left font-medium text-muted-foreground">Frota</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Placa</th>
              <th className="p-3 text-left font-medium text-muted-foreground">CD</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Último serviço</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Próxima previsão</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {ordenado.map((f) => (
              <tr
                key={f.veiculo_id}
                className="border-b odd:bg-white even:bg-slate-50/60 last:border-0"
              >
                <td className="p-3 font-medium">{f.frota_geral ?? String(f.veiculo_id)}</td>
                <td className="p-3">{f.placa ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{f.localizacao ?? "—"}</td>
                <td className="p-3">{f.data_servico ? formatDate(f.data_servico) : "—"}</td>
                <td className="p-3">
                  <div className="font-medium">{f.data_proxima ? formatDate(f.data_proxima) : "—"}</div>
                  {f.dias_para_vencer != null && (
                    <div className={`mt-0.5 text-xs font-semibold ${
                      f.dias_para_vencer < 0
                        ? "text-red-600"
                        : f.dias_para_vencer <= 60
                          ? "text-amber-600"
                          : "text-emerald-600"
                    }`}>
                      {f.dias_para_vencer > 0
                        ? `Faltam ${f.dias_para_vencer} dias`
                        : `Vencido há ${Math.abs(f.dias_para_vencer)} dias`}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <Badge variant="outline" className={STATUS_CLASS[f.status]}>
                    {STATUS_LABEL[f.status]}
                  </Badge>
                </td>
              </tr>
            ))}
            {ordenado.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Nenhuma frota encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
