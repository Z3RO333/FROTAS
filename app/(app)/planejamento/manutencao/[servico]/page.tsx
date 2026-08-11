import Link from "next/link";
import { ArrowLeft, Gauge, Wrench } from "lucide-react";
import { notFound } from "next/navigation";
import { getServiceCatalogItem } from "@/lib/manutencao-service-catalog";
import { listHistoricoServico, listVeiculosParaServico } from "@/lib/repos/manutencao/servicos";
import { calculateDateSchedule, calendarDate } from "@/lib/maintenance-schedule";
import { reportCalendarDate } from "@/lib/report-date";
import { formatCalendarDate } from "@/lib/utils";
import { RegistrarServicoForm } from "@/components/manutencao/registrar-servico-form";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ServicoPage({ params }: { params: Promise<{ servico: string }> }) {
  const { servico: slug } = await params;
  const config = getServiceCatalogItem(slug);
  if (!config) notFound();

  const [veiculos, historico] = await Promise.all([
    listVeiculosParaServico(),
    listHistoricoServico(config.type),
  ]);
  const today = reportCalendarDate();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Serviços da frota"
        title={config.label}
        description={`${config.description} Ao registrar, a frota fica bloqueada até ser retirada da manutenção.`}
        icon={config.intervalType === "km" ? Gauge : Wrench}
        severity="MANUTENCAO"
      />

      <RegistrarServicoForm
        veiculos={veiculos}
        today={today}
        fixedType={config.type}
        serviceLabel={config.label}
      />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Histórico de {config.label.toLocaleLowerCase("pt-BR")}</h2>
            <p className="text-sm text-slate-500">{historico.length} registros mais recentes.</p>
          </div>
          <Link href="/planejamento/manutencao" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800">
            <ArrowLeft className="h-4 w-4" /> Preventivas
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3">Frota</th>
                  <th className="p-3">Data realizada</th>
                  <th className="p-3 text-right">KM</th>
                  <th className="p-3">Próximo serviço</th>
                  <th className="p-3">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historico.map((row) => {
                  const configuredInterval = config.intervalField && row.veiculo
                    ? row.veiculo[config.intervalField]
                    : null;
                  const interval = configuredInterval ?? config.defaultInterval ?? 0;
                  const nextDate = config.intervalType === "days"
                    ? calculateDateSchedule(row.data_servico, interval, today).nextDate
                    : null;
                  const nextKm = config.intervalType === "km" && row.quilometragem != null
                    ? row.quilometragem + interval
                    : null;

                  return (
                    <tr key={row.id_servico} className="hover:bg-blue-50/40">
                      <td className="p-3"><div className="font-medium text-slate-950">{row.id_veiculo}</div><div className="font-mono text-xs text-slate-500">{row.veiculo?.placa ?? "—"}</div></td>
                      <td className="p-3 tabular-nums">{formatCalendarDate(calendarDate(row.data_servico))}</td>
                      <td className="p-3 text-right tabular-nums">{row.quilometragem?.toLocaleString("pt-BR") ?? "—"}</td>
                      <td className="p-3">
                        {nextDate ? (
                          <><div className="font-medium tabular-nums">{formatCalendarDate(nextDate)}</div><div className="text-xs text-slate-500">em {interval.toLocaleString("pt-BR")} dias</div></>
                        ) : nextKm != null ? (
                          <><div className="font-medium tabular-nums">{nextKm.toLocaleString("pt-BR")} km</div><div className="text-xs text-slate-500">intervalo de {interval.toLocaleString("pt-BR")} km</div></>
                        ) : (
                          <Badge variant="outline">Informe o KM</Badge>
                        )}
                      </td>
                      <td className="max-w-sm p-3 text-slate-600">{row.observacoes ?? "—"}</td>
                    </tr>
                  );
                })}
                {historico.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhum registro de {config.label.toLocaleLowerCase("pt-BR")} ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
