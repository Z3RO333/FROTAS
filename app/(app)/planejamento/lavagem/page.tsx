import { AlertTriangle, CalendarClock, CheckCircle2, Droplets, Plus } from "lucide-react";
import { getLavagem } from "@/lib/repos/planejamento";
import { listVeiculosParaServico } from "@/lib/repos/manutencao/servicos";
import { reportCalendarDate } from "@/lib/report-date";
import { formatCalendarDate } from "@/lib/utils";
import {
  RegistrarServicoDialogProvider,
  RegistrarServicoTrigger,
} from "@/components/manutencao/registrar-servico-dialog";
import { ServiceNavigation } from "@/components/manutencao/service-navigation";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LavagemPage() {
  const [rows, veiculos] = await Promise.all([getLavagem(), listVeiculosParaServico()]);
  const atrasadas = rows.filter((row) => row.status === "VENCIDO");
  const semRegistro = rows.filter((row) => row.status === "SEM_REGISTRO").length;
  const emDia = rows.filter((row) => row.status === "NO_PRAZO").length;
  const criticas = atrasadas.filter((row) => (row.atraso_dias ?? 0) >= 7).length;
  const veiculoPorCodigo = new Map(veiculos.map((veiculo) => [veiculo.codigo_frota, veiculo]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Serviços da frota"
        title="Lavagem"
        description="Cadastro, prazo e histórico de lavagem em um só lugar. Ao registrar, a frota fica bloqueada até ser retirada da manutenção."
        icon={Droplets}
        severity={atrasadas.length > 0 ? "ATENCAO" : "OK"}
      />

      <ServiceNavigation compact />

      <MetricGrid cols={4}>
        <MetricCard label="Em dia" value={emDia} icon={CheckCircle2} severity="OK" />
        <MetricCard label="Atrasadas" value={atrasadas.length} icon={AlertTriangle} severity={atrasadas.length ? "CRITICO" : "OK"} />
        <MetricCard label="Sem registro" value={semRegistro} icon={CalendarClock} severity={semRegistro ? "ATENCAO" : "OK"} />
        <MetricCard label="7+ dias atrasadas" value={criticas} icon={AlertTriangle} severity={criticas ? "CRITICO" : "OK"} />
      </MetricGrid>

      <RegistrarServicoDialogProvider
        veiculos={veiculos}
        today={reportCalendarDate()}
        fixedType="lavagem"
        serviceLabel="Lavagem"
      >
        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Agenda de lavagem</h2>
              <p className="text-sm text-slate-500">Clique na frota para registrar a lavagem. O intervalo padrão é de 30 dias.</p>
            </div>
            <RegistrarServicoTrigger className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Registrar lavagem
            </RegistrarServicoTrigger>
          </div>

          <div className="grid gap-3 md:hidden">
            {rows.map((row) => (
              <article
                key={row.frota_numero ?? row.equipamento ?? row.placa}
                className={cn(
                  "relative rounded-xl border border-l-4 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md",
                  row.status === "VENCIDO"
                    ? "border-l-red-500"
                    : row.status === "SEM_REGISTRO"
                      ? "border-l-amber-500"
                      : "border-l-emerald-500"
                )}
              >
                <RegistrarServicoTrigger
                  vehicle={veiculoPorCodigo.get(row.frota_numero ?? "")}
                  className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  ariaLabel={`Registrar lavagem da frota ${row.frota_numero ?? row.placa ?? "selecionada"}`}
                >
                  <span className="sr-only">Registrar lavagem</span>
                </RegistrarServicoTrigger>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">Frota {row.frota_numero ?? "—"}</p>
                    <p className="text-xs text-slate-500">{row.placa ?? "Sem placa"}</p>
                  </div>
                  <StatusBadge status={row.status} size="sm" />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-slate-500">Realizada</dt><dd className="mt-0.5 font-medium">{formatCalendarDate(row.data_realizada)}</dd></div>
                  <div><dt className="text-slate-500">Próxima</dt><dd className="mt-0.5 font-medium">{formatCalendarDate(row.proxima_data)}</dd></div>
                  <div><dt className="text-slate-500">KM</dt><dd className="mt-0.5 font-medium">{row.quilometragem?.toLocaleString("pt-BR") ?? "—"}</dd></div>
                  <div><dt className="text-slate-500">Intervalo</dt><dd className="mt-0.5 font-medium">{row.intervalo_dias} dias</dd></div>
                </dl>
                {row.observacoes && <p className="mt-3 border-t pt-3 text-xs text-slate-600">{row.observacoes}</p>}
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-3">Frota</th>
                    <th className="p-3">Data realizada</th>
                    <th className="p-3">Próxima lavagem</th>
                    <th className="p-3 text-right">KM</th>
                    <th className="p-3">Observação</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.frota_numero ?? row.equipamento ?? row.placa} className="hover:bg-blue-50/40">
                      <td className="p-0">
                        <RegistrarServicoTrigger
                          vehicle={veiculoPorCodigo.get(row.frota_numero ?? "")}
                          className="block w-full p-3 text-left hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                          ariaLabel={`Registrar lavagem da frota ${row.frota_numero ?? row.placa ?? "selecionada"}`}
                        >
                          <div className="font-medium">{row.frota_numero ?? "—"}</div>
                          <div className="font-mono text-xs text-slate-500">{row.placa ?? "—"}</div>
                        </RegistrarServicoTrigger>
                      </td>
                      <td className="p-3 tabular-nums">{formatCalendarDate(row.data_realizada)}</td>
                      <td className="p-3 tabular-nums"><div className="font-medium">{formatCalendarDate(row.proxima_data)}</div><div className="text-xs text-slate-500">a cada {row.intervalo_dias} dias</div></td>
                      <td className="p-3 text-right tabular-nums">{row.quilometragem?.toLocaleString("pt-BR") ?? "—"}</td>
                      <td className="max-w-xs truncate p-3 text-slate-600" title={row.observacoes ?? undefined}>{row.observacoes ?? "—"}</td>
                      <td className="p-3"><StatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </RegistrarServicoDialogProvider>
    </div>
  );
}
