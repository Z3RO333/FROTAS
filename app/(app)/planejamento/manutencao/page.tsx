import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Cog,
  Fan,
  Gauge,
  ShieldAlert,
  Snowflake,
  Wrench,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import { Fragment } from "react";
import type { ComponentType, ReactNode } from "react";
import { listFrotasEmManutencaoAgora, type ParadaRow } from "@/lib/repos/planejamento";
import { getManutencaoStatus, TIPO_SERVICO_APP, type ManutencaoStatusRow } from "@/lib/repos/manutencao/status";
import { listServicosRecentes, listVeiculosParaServico } from "@/lib/repos/manutencao/servicos";
import type { TipoServico } from "@/lib/repos/manutencao/types";
import { reportCalendarDate } from "@/lib/report-date";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { SEVERITY, severityFromStatus } from "@/lib/design/tokens";
import { cn, formatDate } from "@/lib/utils";
import { ServiceNavigation } from "@/components/manutencao/service-navigation";
import { RetornarOperacaoDialog } from "@/components/frotas/manutencao/retornar-operacao-dialog";
import {
  RegistrarServicoDialogProvider,
  RegistrarServicoTrigger,
} from "@/components/manutencao/registrar-servico-dialog";

export const dynamic = "force-dynamic";

const TIPO_LABELS: Record<string, string> = {
  AR_CONDICIONADO: "Ar Condicionado",
  ALINHAMENTO: "Alinhamento",
  PREVENTIVA_MOTOR: "Preventiva Motor",
  EMBREAGEM: "Embreagem",
  TACOGRAFO: "Tacógrafo",
  PORTA_ROOL_UP: "Porta Roll Up",
  SUSPENSAO: "Suspensão",
};

const TIPO_ICONS: Record<string, ComponentType<LucideProps>> = {
  AR_CONDICIONADO: Snowflake,
  ALINHAMENTO: Gauge,
  PREVENTIVA_MOTOR: Cog,
  EMBREAGEM: Wrench,
  TACOGRAFO: ClipboardCheck,
  PORTA_ROOL_UP: ShieldAlert,
  SUSPENSAO: Fan,
};

const SERVICO_APP_LABELS: Record<string, string> = {
  lavagem: "Lavagem",
  alinhamento: "Alinhamento",
  balanceamento: "Balanceamento",
  motor: "Preventiva do motor",
  suspensao: "Suspensão",
  "ar-condicionado": "Ar-condicionado",
  embreagem: "Embreagem",
  portas_rool_up: "Porta Roll-Up",
  tacografo: "Tacógrafo",
  bateria: "Bateria",
};

const CLASSIFICACAO_ICONS: Record<string, ComponentType<LucideProps>> = {
  PREVENTIVA: ClipboardCheck,
  CORRETIVA: Wrench,
  EMERGENCIAL: AlertTriangle,
  OUTRA: Cog,
};

function classificacaoLabel(classificacao: string | null): string {
  if (!classificacao) return "Não classificado";
  const key = classificacao.trim().toUpperCase();
  const labels: Record<string, string> = {
    PREVENTIVA: "Preventiva",
    CORRETIVA: "Corretiva",
    EMERGENCIAL: "Emergencial",
    OUTRA: "Outra",
  };
  return labels[key] ?? classificacao;
}

function paradaAtrasada(row: ParadaRow, hoje: Date): boolean {
  if (!row.prev_saida) return false;
  return new Date(`${row.prev_saida}T00:00:00`) < hoje;
}

export default async function ManutencaoPage() {
  const [rows, servicosRecentes, paradas, veiculosParaServico] = await Promise.all([
    getManutencaoStatus(),
    listServicosRecentes(100),
    listFrotasEmManutencaoAgora(),
    listVeiculosParaServico(),
  ]);
  const today = reportCalendarDate();

  const hoje = new Date();
  const paradasPorClassificacao = paradas.reduce<Record<string, ParadaRow[]>>((acc, r) => {
    const key = r.classificacao?.trim().toUpperCase() || "OUTRA";
    acc[key] ??= [];
    acc[key].push(r);
    return acc;
  }, {});
  const paradasSummary = Object.entries(paradasPorClassificacao)
    .map(([classificacao, items]) => ({
      classificacao,
      total: items.length,
      atrasadas: items.filter((r) => paradaAtrasada(r, hoje)).length,
    }))
    .sort((a, b) => b.total - a.total);

  const byTipo = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    acc[r.tipo_servico] ??= [];
    acc[r.tipo_servico].push(r);
    return acc;
  }, {});

  const summary = Object.entries(byTipo).map(([tipo, items]) => ({
    tipo,
    total: items.length,
    ok: items.filter((i) => i.status === "NO_PRAZO").length,
    atrasado: items.filter((i) => i.status === "VENCIDO").length,
    sem_registro: items.filter((i) => i.status === "SEM_REGISTRO").length,
  }));

  const atrasadas = rows.filter((r) => r.status === "VENCIDO");

  const totalAtrasado = atrasadas.length;
  const totalNoPrazo = rows.filter((r) => r.status === "NO_PRAZO").length;
  const totalSemRegistro = rows.filter((r) => r.status === "SEM_REGISTRO").length;

  return (
    <RegistrarServicoDialogProvider veiculos={veiculosParaServico} today={today}>
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manutenção"
        title="Radar de Preventivas"
        description={`${rows.length} controles ativos · ${totalAtrasado} fora do prazo, ${totalNoPrazo} em dia.`}
        icon={Wrench}
        severity={totalAtrasado > 0 ? "ATENCAO" : "OK"}
      />

      <MetricGrid cols={3}>
        <MetricCard
          label="Em dia"
          value={totalNoPrazo}
          icon={CheckCircle2}
          severity="OK"
          hint={`${rows.length > 0 ? Math.round((totalNoPrazo / rows.length) * 100) : 0}% do total`}
        />
        <MetricCard
          label="Fora do prazo"
          value={totalAtrasado}
          icon={AlertTriangle}
          severity="CRITICO"
          hint={atrasadas[0] ? `Maior desvio: ${atrasadas[0].frota_numero ?? "—"}` : "Sem atrasos"}
        />
        <MetricCard
          label="Sem registro"
          value={totalSemRegistro}
          icon={CalendarClock}
          severity="ATENCAO"
          hint="Nunca tiveram serviço lançado"
        />
      </MetricGrid>

      <ServiceNavigation />

      {/* Cards por tipo de serviço */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="h-1 w-6 rounded-full bg-violet-500" />
          Por tipo de serviço
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {summary
            .sort((a, b) => b.atrasado - a.atrasado)
            .map((s) => {
              const Icon = TIPO_ICONS[s.tipo] ?? Wrench;
              const severity = s.atrasado > 0 ? "CRITICO" : s.sem_registro > 0 ? "ATENCAO" : "OK";
              const tone = SEVERITY[severity];
              return (
                <div
                  key={s.tipo}
                  className="group relative overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[0_2px_0_rgba(15,23,42,0.04),0_16px_32px_-12px_rgba(15,23,42,0.22)]"
                >
                  <span className={cn("pointer-events-none absolute inset-x-0 top-0 h-[3px]", tone.bar)} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {TIPO_LABELS[s.tipo] ?? s.tipo}
                      </p>
                      <div className="mt-2 flex items-end gap-2">
                        <span className={cn("text-3xl font-semibold tabular-nums", tone.icon)}>
                          {s.atrasado}
                        </span>
                        <span className="mb-1 text-xs text-slate-400">/ {s.total}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span className="text-emerald-700">{s.ok} no prazo</span>
                        {s.sem_registro > 0 && <span className="text-amber-700">{s.sem_registro} sem registro</span>}
                      </div>
                    </div>
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tone.tile)}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* Frotas atualmente em manutenção (paradas), categorizadas por tipo */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="h-1 w-6 rounded-full bg-amber-500" />
          Em manutenção agora ({paradas.length})
        </h2>

        {paradas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-12 text-center text-sm text-slate-500">
            Nenhuma frota em manutenção no momento.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {paradasSummary.map((s) => {
                const Icon = CLASSIFICACAO_ICONS[s.classificacao] ?? Wrench;
                const severity = s.atrasadas > 0 ? "CRITICO" : "ATENCAO";
                const tone = SEVERITY[severity];
                return (
                  <div
                    key={s.classificacao}
                    className="group relative overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[0_2px_0_rgba(15,23,42,0.04),0_16px_32px_-12px_rgba(15,23,42,0.22)]"
                  >
                    <span className={cn("pointer-events-none absolute inset-x-0 top-0 h-[3px]", tone.bar)} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {classificacaoLabel(s.classificacao)}
                        </p>
                        <div className="mt-2 flex items-end gap-2">
                          <span className={cn("text-3xl font-semibold tabular-nums", tone.icon)}>{s.total}</span>
                        </div>
                        {s.atrasadas > 0 && (
                          <div className="mt-1 text-[11px] text-red-700">
                            {s.atrasadas} com retorno atrasado
                          </div>
                        )}
                      </div>
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tone.tile)}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-3 text-left">Frota</th>
                      <th className="p-3 text-left">Placa</th>
                      <th className="p-3 text-left">Setor</th>
                      <th className="p-3 text-left">Tipo</th>
                      <th className="p-3 text-left">Motivo</th>
                      <th className="p-3 text-left">Oficina</th>
                      <th className="p-3 text-left">Início</th>
                      <th className="p-3 text-left">Prev. retorno</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paradas.map((r, i) => {
                      const atrasada = paradaAtrasada(r, hoje);
                      const Wrapper = r.veiculo_id
                        ? ({ children }: { children: ReactNode }) => (
                            <Link href={`/frotas/${r.veiculo_id}`} className="contents">
                              {children}
                            </Link>
                          )
                        : Fragment;
                      return (
                        <tr key={`p-${i}`} className="transition-colors hover:bg-blue-50/40">
                          <td className="p-3 font-medium text-slate-900">
                            <Wrapper>{r.frota_numero ?? "—"}</Wrapper>
                          </td>
                          <td className="p-3 font-mono text-xs text-slate-700">{r.placa ?? "—"}</td>
                          <td className="p-3 text-xs text-slate-500">{r.setor ?? "—"}</td>
                          <td className="p-3 text-xs text-slate-600">{classificacaoLabel(r.classificacao)}</td>
                          <td className="max-w-xs truncate p-3 text-xs text-slate-600" title={r.descricao_original}>
                            {r.descricao_original}
                          </td>
                          <td className="p-3 text-xs text-slate-500">{r.oficina ?? "—"}</td>
                          <td className="p-3 text-xs tabular-nums text-slate-600">{r.inicio_em ?? "—"}</td>
                          <td className={cn("p-3 text-xs tabular-nums", atrasada ? "font-medium text-red-600" : "text-slate-600")}>
                            {r.prev_saida ?? "—"}
                          </td>
                          <td className="p-3 text-right">
                            {r.veiculo_id && (
                              <RetornarOperacaoDialog
                                frotaId={r.veiculo_id}
                                frotaLabel={r.frota_numero ?? r.placa ?? String(r.veiculo_id)}
                                size="sm"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 md:hidden">
              {paradas.map((r, i) => {
                const atrasada = paradaAtrasada(r, hoje);
                return (
                  <div
                    key={`pm-${i}`}
                    className={cn(
                      "rounded-xl border border-l-4 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]",
                      atrasada ? "border-l-red-500" : "border-l-amber-500"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {r.frota_numero ?? r.placa ?? "—"}
                          </span>
                          {r.placa && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                              {r.placa}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {classificacaoLabel(r.classificacao)}
                          {r.setor ? ` · ${r.setor}` : ""}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-600">{r.descricao_original}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Início: {r.inicio_em ?? "—"}</span>
                      <span className={cn("font-medium", atrasada ? "text-red-600" : "text-slate-500")}>
                        Prev.: {r.prev_saida ?? "—"}
                      </span>
                    </div>
                    {r.veiculo_id && (
                      <div className="mt-3 flex justify-end">
                        <RetornarOperacaoDialog
                          frotaId={r.veiculo_id}
                          frotaLabel={r.frota_numero ?? r.placa ?? String(r.veiculo_id)}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Lista de itens com atenção */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="h-1 w-6 rounded-full bg-red-500" />
          Itens fora do prazo ({atrasadas.length})
        </h2>

        {atrasadas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-12 text-center text-sm text-slate-500">
            Nenhum item fora do prazo. Tudo no verde.
          </div>
        ) : (
          <>
            {/* Cards mobile */}
            <div className="grid gap-3 md:hidden">
              {atrasadas.slice(0, 200).map((r, i) => (
                <AtencaoCard key={`m-${i}`} row={r} />
              ))}
            </div>

            {/* Tabela desktop */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-3 text-left">Frota</th>
                      <th className="p-3 text-left">Placa</th>
                      <th className="p-3 text-left">Setor</th>
                      <th className="p-3 text-left">Serviço</th>
                      <th className="p-3 text-left">Última data</th>
                      <th className="p-3 text-right">Desvio</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {atrasadas.slice(0, 200).map((r, i) => {
                      const Icon = TIPO_ICONS[r.tipo_servico] ?? Wrench;
                      const severity = severityFromStatus(r.status);
                      const tone = SEVERITY[severity];
                      return (
                        <tr key={`r-${i}`} className="transition-colors hover:bg-blue-50/40">
                          <td className="p-3 font-medium text-slate-900">{r.frota_numero ?? "—"}</td>
                          <td className="p-3 font-mono text-xs text-slate-700">{r.placa ?? "—"}</td>
                          <td className="p-3 text-xs text-slate-500">{r.setor ?? "—"}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", tone.tile)}>
                                <Icon className="h-3 w-3" aria-hidden="true" />
                              </span>
                              <span className="text-xs">{TIPO_LABELS[r.tipo_servico] ?? r.tipo_servico}</span>
                            </span>
                          </td>
                          <td className="p-3 text-xs text-slate-600 tabular-nums">{r.data_realizada ?? "—"}</td>
                          <td className="p-3 text-right text-xs tabular-nums">
                            {r.desvio != null ? (
                              <span className={cn("font-medium", r.desvio < 0 ? "text-red-600" : "text-slate-500")}>
                                {r.desvio.toLocaleString("pt-BR")}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-3">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="p-3 text-right">
                            <RegistrarTrigger row={r} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span className="h-1 w-6 rounded-full bg-blue-500" />
            Serviços realizados recentemente
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Histórico dos últimos {servicosRecentes.length} registros feitos nas páginas de serviço.
          </p>
        </div>

        <div className="grid gap-3 md:hidden">
          {servicosRecentes.map((servico) => (
            <article key={servico.id_servico} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">
                    Frota {servico.veiculo?.codigo_frota ?? servico.id_veiculo}
                  </p>
                  <p className="font-mono text-xs text-slate-500">{servico.veiculo?.placa ?? "—"}</p>
                </div>
                <Badge variant="outline">{SERVICO_APP_LABELS[servico.tipo_servico] ?? servico.tipo_servico}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{formatDate(servico.data_servico)}</span>
                <span>{servico.quilometragem?.toLocaleString("pt-BR") ?? "—"} km</span>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Frota</th>
                  <th className="p-3">Placa</th>
                  <th className="p-3">Serviço</th>
                  <th className="p-3 text-right">KM</th>
                  <th className="p-3">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {servicosRecentes.map((servico) => (
                  <tr key={servico.id_servico} className="transition-colors hover:bg-blue-50/40">
                    <td className="p-3 tabular-nums">{formatDate(servico.data_servico)}</td>
                    <td className="p-3 font-medium text-slate-950">{servico.veiculo?.codigo_frota ?? servico.id_veiculo}</td>
                    <td className="p-3 font-mono text-xs text-slate-600">{servico.veiculo?.placa ?? "—"}</td>
                    <td className="p-3"><Badge variant="outline">{SERVICO_APP_LABELS[servico.tipo_servico] ?? servico.tipo_servico}</Badge></td>
                    <td className="p-3 text-right tabular-nums">{servico.quilometragem?.toLocaleString("pt-BR") ?? "—"}</td>
                    <td className="max-w-sm truncate p-3 text-slate-600" title={servico.observacoes ?? undefined}>{servico.observacoes ?? "—"}</td>
                  </tr>
                ))}
                {servicosRecentes.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nenhum serviço registrado ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Link rápido pra detalhe de tacógrafo */}
      <Link
        href="/planejamento/manutencao/tacografo"
        className="group inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
      >
        Ver detalhe de Tacógrafo
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>
    </div>
    </RegistrarServicoDialogProvider>
  );
}

function RegistrarTrigger({ row, className }: { row: ManutencaoStatusRow; className?: string }) {
  const tipoServico = TIPO_SERVICO_APP[row.tipo_servico] as TipoServico | undefined;
  if (!tipoServico || !row.frota_numero) return null;
  return (
    <RegistrarServicoTrigger
      vehicle={{ codigo_frota: row.frota_numero, placa: row.placa }}
      tipoServico={tipoServico}
      ariaLabel={`Registrar ${TIPO_LABELS[row.tipo_servico] ?? row.tipo_servico} da frota ${row.frota_numero}`}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md bg-blue-50 px-2 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200 transition-colors hover:bg-blue-100",
        className
      )}
    >
      Registrar
    </RegistrarServicoTrigger>
  );
}

function AtencaoCard({ row }: { row: ManutencaoStatusRow }) {
  const Icon = TIPO_ICONS[row.tipo_servico] ?? Wrench;
  const severity = severityFromStatus(row.status);
  const tone = SEVERITY[severity];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-l-4 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]",
        severity === "CRITICO"
          ? "border-l-red-500"
          : severity === "ATENCAO"
            ? "border-l-amber-500"
            : "border-l-slate-300"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", tone.tile)}>
              <Icon className="h-3 w-3" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {row.frota_numero ?? row.placa ?? "—"}
            </span>
            {row.placa && (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                {row.placa}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {TIPO_LABELS[row.tipo_servico] ?? row.tipo_servico}
            {row.setor ? ` · ${row.setor}` : ""}
          </p>
        </div>
        <StatusBadge status={row.status} size="sm" />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-slate-500">{row.data_realizada ?? "Sem data"}</span>
        {row.desvio != null && (
          <span className={cn("font-medium tabular-nums", row.desvio < 0 ? "text-red-600" : "text-slate-500")}>
            {row.desvio.toLocaleString("pt-BR")} km
          </span>
        )}
      </div>
      <div className="mt-3 flex justify-end">
        <RegistrarTrigger row={row} />
      </div>
    </div>
  );
}
