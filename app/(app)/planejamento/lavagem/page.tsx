import { AlertTriangle, CalendarClock, CheckCircle2, Droplets } from "lucide-react";
import { getLavagem } from "@/lib/repos/planejamento";
import { listVeiculosParaServico } from "@/lib/repos/manutencao/servicos";
import { reportCalendarDate } from "@/lib/report-date";
import { formatCalendarDate } from "@/lib/utils";
import { RegistrarServicoForm } from "@/components/manutencao/registrar-servico-form";
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Serviços da frota"
        title="Lavagem"
        description="Cadastro, prazo e histórico de lavagem em um só lugar. Ao registrar, a frota fica bloqueada até ser retirada da manutenção."
        icon={Droplets}
        severity={atrasadas.length > 0 ? "ATENCAO" : "OK"}
      />

      <RegistrarServicoForm
        veiculos={veiculos}
        today={reportCalendarDate()}
        fixedType="lavagem"
        serviceLabel="Lavagem"
      />

      <MetricGrid cols={4}>
        <MetricCard label="Em dia" value={emDia} icon={CheckCircle2} severity="OK" />
        <MetricCard label="Atrasadas" value={atrasadas.length} icon={AlertTriangle} severity={atrasadas.length ? "CRITICO" : "OK"} />
        <MetricCard label="Sem registro" value={semRegistro} icon={CalendarClock} severity={semRegistro ? "ATENCAO" : "OK"} />
        <MetricCard label="7+ dias atrasadas" value={criticas} icon={AlertTriangle} severity={criticas ? "CRITICO" : "OK"} />
      </MetricGrid>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Agenda de lavagem</h2>
          <p className="text-sm text-slate-500">A próxima lavagem usa o intervalo configurado para cada frota (30 dias por padrão).</p>
        </div>

        <div className="grid gap-3 md:hidden">
          {rows.map((row) => (
            <article
              key={row.frota_numero ?? row.equipamento ?? row.placa}
              className={cn(
                "rounded-xl border border-l-4 bg-white p-4 shadow-sm",
                row.status === "VENCIDO"
                  ? "border-l-red-500"
                  : row.status === "SEM_REGISTRO"
                    ? "border-l-amber-500"
                    : "border-l-emerald-500"
              )}
            >
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
                    <td className="p-3"><div className="font-medium text-slate-950">{row.frota_numero ?? "—"}</div><div className="font-mono text-xs text-slate-500">{row.placa ?? "—"}</div></td>
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
    </div>
  );
}
