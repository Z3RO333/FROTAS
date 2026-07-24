import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Mail,
  ExternalLink,
  Settings,
  Truck,
  Wrench,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canManageEmailSchedules, requireAdminUser } from "@/lib/rbac";
import {
  getDisponibilidadePorCD,
  getDisponibilidadeResumo,
  getPontosAtencao,
  listCDsDisponibilidade,
  listFrotasEmManutencao,
  type DisponibilidadeCD,
  type DisponibilidadeGeral,
} from "@/lib/repos/disponibilidade";
import { listEmailLogs } from "@/lib/repos/email-logs";
import { listEmailSchedules } from "@/lib/repos/email-schedule";
import { EnviarRelatorioDialog } from "@/components/relatorios/enviar-relatorio-dialog";
import {
  createDisponibilidadeScheduleAction,
  deleteDisponibilidadeScheduleAction,
  toggleDisponibilidadeScheduleAction,
  enviarRelatorioDisponibilidadeCDAction,
} from "./_actions";
import { CDFilterSelect } from "./_cd-filter";

export const dynamic = "force-dynamic";

type SearchParams = {
  cd?: string;
  sucesso?: string;
  erro?: string;
};

const FREQUENCIA_LABELS: Record<string, string> = {
  DIARIO: "Diário",
  SEMANAL: "Semanal",
  QUINZENAL: "Quinzenal",
  MENSAL: "Mensal",
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function cdLabel(scheduleCds: string[]): string {
  return scheduleCds.length > 0 ? scheduleCds.join(", ") : "Todos os CDs";
}

function isCdResumo(resumo: DisponibilidadeCD | DisponibilidadeGeral): resumo is DisponibilidadeCD {
  return "cd_nome" in resumo;
}

export default async function FrotasDisponibilidadesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireAdminUser();
  const canConfigure = canManageEmailSchedules(actor.perfil);
  const sp = await searchParams;

  const [cds, cdsResumo] = await Promise.all([listCDsDisponibilidade(), getDisponibilidadePorCD()]);
  const selectedCd = sp.cd && cds.includes(sp.cd) ? sp.cd : undefined;

  const [resumoRaw, manutencoes, pontos, allSchedules, history] = await Promise.all([
    getDisponibilidadeResumo(selectedCd),
    listFrotasEmManutencao(selectedCd, 100),
    getPontosAtencao(18, selectedCd),
    listEmailSchedules(),
    listEmailLogs(30, "disponibilidade_cd"),
  ]);

  const resumo = isCdResumo(resumoRaw)
    ? resumoRaw
    : ({ cd_nome: "Todos os CDs", ...resumoRaw } satisfies DisponibilidadeCD);
  const schedules = allSchedules.filter((schedule) => schedule.tipo === "DISPONIBILIDADE");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Frotas"
        title="Disponibilidade por CD"
        description={`${resumo.total} frota(s) monitorada(s) em ${resumo.cd_nome}.`}
        icon={Truck}
        severity="INFO"
        actions={
          <div className="flex gap-2">
            <EnviarRelatorioDialog
              title={`Enviar relatório${selectedCd ? ` — ${selectedCd}` : " — Todos os CDs"}`}
              action={enviarRelatorioDisponibilidadeCDAction.bind(null, selectedCd)}
              triggerLabel="Enviar relatório"
              triggerVariant="outline"
            />
            <Button asChild variant="outline">
              <Link href="/frotas">Tabela de frotas</Link>
            </Button>
          </div>
        }
      />

      {sp.sucesso ? <Alert tone="success" message={sp.sucesso} /> : null}
      {sp.erro ? <Alert tone="danger" message={sp.erro} /> : null}

      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <Label htmlFor="cd">Centro de distribuição</Label>
        <div className="mt-1.5">
          <CDFilterSelect cds={cds} selected={selectedCd} />
        </div>
      </div>

      <MetricGrid cols={6}>
        <MetricCard label="Total de frotas" value={resumo.total} icon={Truck} severity="INFO" />
        <MetricCard label="Disponíveis" value={resumo.disponiveis} icon={CheckCircle2} severity="OK" />
        <MetricCard label="Manutenção" value={resumo.em_manutencao} icon={Wrench} severity="MANUTENCAO" />
        <MetricCard label="Indisponíveis" value={resumo.indisponiveis} icon={XCircle} severity="CRITICO" />
        <MetricCard label="Em operação" value={resumo.em_operacao} icon={Clock} severity="NEUTRO" />
        <MetricCard
          label="Disponibilidade"
          value={`${resumo.percentual_disponibilidade}%`}
          icon={CheckCircle2}
          severity={resumo.percentual_disponibilidade >= 80 ? "OK" : resumo.percentual_disponibilidade >= 60 ? "ATENCAO" : "CRITICO"}
        />
      </MetricGrid>

      {!selectedCd && cdsResumo.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader title="Resumo por CD" description="Comparativo consolidado por unidade." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cdsResumo.map((cd) => (
              <Link
                key={cd.cd_nome}
                href={`/frotas?cd=${encodeURIComponent(cd.cd_nome)}`}
                className="rounded-lg border bg-white p-4 shadow-sm transition-colors hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{cd.cd_nome}</p>
                    <p className="mt-1 text-xs text-slate-500">{cd.total} frota(s)</p>
                  </div>
                  <p className="text-2xl font-semibold tabular-nums text-slate-950">
                    {cd.percentual_disponibilidade}%
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                  <MiniStat label="Disp." value={cd.disponiveis} tone="text-emerald-700" />
                  <MiniStat label="Manut." value={cd.em_manutencao} tone="text-amber-700" />
                  <MiniStat label="Indisp." value={cd.indisponiveis} tone="text-red-700" />
                <MiniStat label="Atenção" value={cd.pontos_atencao} tone="text-slate-700" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionHeader
          title="Frotas em manutenção"
          description="Veículos parados com motivo, responsável e tempo de permanência."
        />
        {manutencoes.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Nenhuma frota em manutenção"
            description="O filtro atual não possui frotas marcadas como manutenção."
          />
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>CD</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Envio</TableHead>
                    <TableHead className="text-right">Tempo parado</TableHead>
                    <TableHead>Local atual</TableHead>
                    <TableHead>Responsavel</TableHead>
                    <TableHead className="text-right">Atalho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manutencoes.map((frota) => (
                    <TableRow key={frota.id} className="group transition-colors hover:bg-blue-50/50">
                      <TableCell>
                        <Link
                          href={`/frotas/${frota.id}`}
                          className="inline-flex items-center gap-1.5 font-mono font-semibold text-blue-700 hover:underline"
                          title="Abrir visão 360 da frota"
                        >
                          {frota.placa ?? frota.frota_geral ?? `#${frota.id}`}
                          <ExternalLink className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
                        </Link>
                      </TableCell>
                      <TableCell>{frota.modelo ?? "-"}</TableCell>
                      <TableCell>{frota.cd_nome}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={frota.motivo ?? undefined}>
                        {frota.motivo ?? frota.tipo ?? "-"}
                      </TableCell>
                      <TableCell>{formatDate(frota.data_envio)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {frota.tempo_parado_dias != null ? `${frota.tempo_parado_dias} dia(s)` : "-"}
                      </TableCell>
                      <TableCell>{frota.local_atual ?? "-"}</TableCell>
                      <TableCell>{frota.responsavel ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/frotas/${frota.id}`}>Ver 360</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Principais pontos de atenção" description="Alertas filtrados pelo CD selecionado." />
        {pontos.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Sem pontos de atenção no filtro atual"
            description="Não foram encontrados alertas automáticos para este CD."
          />
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {pontos.map((ponto, index) => (
              <Link
                key={`${ponto.frota_id}-${ponto.tipo}-${index}`}
                href={`/frotas/${ponto.frota_id}`}
                className="flex items-start gap-3 rounded-lg border bg-white p-3 transition-colors hover:bg-slate-50"
              >
                <Badge
                  variant="outline"
                  className={
                    ponto.severidade === "CRITICO"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }
                >
                  {ponto.severidade}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{ponto.titulo}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{ponto.descricao}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {ponto.cd_nome} {ponto.placa ? `- ${ponto.placa}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Envios programados por CD"
          description="Configuração e destinatários dos resumos automáticos de disponibilidade."
        />
        {canConfigure ? (
          <Card>
            <CardHeader className="border-b bg-white">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" aria-hidden="true" />
                Nova programação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form action={createDisponibilidadeScheduleAction} className="grid gap-3 lg:grid-cols-[1fr_.8fr_1.2fr_.7fr_.55fr_auto] lg:items-end">
                <Field label="Nome">
                  <Input name="nome" placeholder="Resumo diario CD Manaus" required />
                </Field>
                <Field label="CD">
                  <select
                    name="cd_nome"
                    defaultValue={selectedCd ?? "__ALL__"}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="__ALL__">Todos os CDs</option>
                    {cds.map((cd) => (
                      <option key={cd} value={cd}>
                        {cd}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Destinatarios">
                  <Input name="destinatarios" placeholder="email1@bemol.com.br, email2@bemol.com.br" required />
                </Field>
                <Field label="Frequencia">
                  <select name="frequencia" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="DIARIO">Diário</option>
                    <option value="SEMANAL">Semanal</option>
                    <option value="QUINZENAL">Quinzenal</option>
                    <option value="MENSAL">Mensal</option>
                  </select>
                </Field>
                <Field label="Horario">
                  <Input name="hora_envio" type="time" defaultValue="07:00" required />
                </Field>
                <Button type="submit">Criar</Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            A configuração de envios programados é liberada apenas para usuários Gestores ou Devs.
          </div>
        )}

        <div className="grid gap-3">
          {schedules.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="Nenhum envio programado"
              description="Ainda não há programações de disponibilidade por CD."
            />
          ) : (
            schedules.map((schedule) => (
              <div key={schedule.id} className="flex flex-col gap-3 rounded-lg border bg-white p-4 shadow-sm lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{schedule.nome}</p>
                    <Badge variant="outline">{cdLabel(schedule.cds_incluidos)}</Badge>
                    <Badge
                      variant="outline"
                      className={schedule.ativo ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-500"}
                    >
                      {schedule.ativo ? "Ativo" : "Pausado"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {FREQUENCIA_LABELS[schedule.frequencia] ?? schedule.frequencia} as {String(schedule.hora_envio).slice(0, 5)} -{" "}
                    {schedule.destinatarios.length} destinatario(s)
                    {schedule.ultimo_envio ? ` - ultimo envio ${formatDateTime(schedule.ultimo_envio)}` : ""}
                  </p>
                </div>
                {canConfigure ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={toggleDisponibilidadeScheduleAction}>
                      <input type="hidden" name="id" value={schedule.id} />
                      <input type="hidden" name="ativo" value={String(schedule.ativo)} />
                      <Button type="submit" variant="outline" size="sm">
                        {schedule.ativo ? "Pausar" : "Ativar"}
                      </Button>
                    </form>
                    <form action={deleteDisponibilidadeScheduleAction}>
                      <input type="hidden" name="id" value={schedule.id} />
                      <Button type="submit" variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                        Remover
                      </Button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Historico de envios"
          description="Auditoria dos e-mails automáticos de disponibilidade enviados por CD."
        />
        {history.length === 0 ? (
          <EmptyState icon={History} title="Nenhum envio registrado" description="O histórico aparecerá após os próximos disparos." />
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>CD</TableHead>
                    <TableHead>Data/hora</TableHead>
                    <TableHead>Destinatarios</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead>Resumo enviado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.cd_nome ?? "Todos os CDs"}</TableCell>
                      <TableCell className="tabular-nums">{formatDateTime(log.enviado_em)}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={log.destinatarios ?? undefined}>
                        {log.destinatarios ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={log.status === "enviado" ? "border-emerald-200 text-emerald-700" : "border-red-200 text-red-700"}
                        >
                          {log.status ?? "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate" title={log.erro_msg ?? undefined}>
                        {log.erro_msg ?? "-"}
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate" title={log.resumo ?? undefined}>
                        {log.resumo ?? log.assunto ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5">
      <p className={`font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Alert({ tone, message }: { tone: "success" | "danger"; message: string }) {
  return (
    <div
      className={
        tone === "success"
          ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          : "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      }
    >
      {message}
    </div>
  );
}
