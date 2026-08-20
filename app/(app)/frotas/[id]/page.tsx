import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  ClipboardCheck,
  Edit,
  FileText,
  Fuel,
  Gauge,
  ShieldAlert,
  Truck,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHero, HeroStat } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FrotaInfo } from "@/components/frotas/frota-info";
import { HistoricoTimeline } from "@/components/frotas/historico-timeline";
import { KmEvolutionChart } from "@/components/frotas/km-evolution-chart";
import { UnidadeOperacionalCard } from "@/components/frotas/unidade-operacional-card";
import { VeiculoTabs } from "@/components/frotas/veiculo-360/tabs";
import { ChecklistsListClient } from "@/components/frotas/veiculo-360/checklist-preview-sheet";
import { EventsTimeline } from "@/components/frotas/veiculo-360/events-timeline";
import { FuelGauge } from "@/components/frotas/veiculo-360/fuel-gauge";
import { StatusOperacionalBanner } from "@/components/frotas/manutencao/status-banner";
import { EnviarRelatorioDialog } from "@/components/relatorios/enviar-relatorio-dialog";
import { listAbastecimentosFrota } from "@/lib/repos/abastecimentos";
import { listChecklistsByFrota, listPendenciasByFrota } from "@/lib/repos/checklists";
import { getFrota } from "@/lib/repos/frotas";
import { listHistoricoCompleto, listHistoricoKm } from "@/lib/repos/historico";
import { listDocuments } from "@/lib/repos/manutencao/documents";
import { listTrocasByVeiculo } from "@/lib/repos/manutencao/pneus";
import { listServicosByVeiculo } from "@/lib/repos/manutencao/servicos";
import { listSinistrosByFrota, type SinistroRow } from "@/lib/repos/sinistros";
import type { DocumentRecordWithSignedUrls, ServicoApp, TrocaPneuApp } from "@/lib/repos/manutencao/types";
import { findUnidadeForFrota } from "@/lib/repos/unidades";
import { listEventosByVeiculo } from "@/lib/services/veiculo-eventos";
import { requireAdminUser, canEditFrota } from "@/lib/rbac";
import { safeReturnTo } from "@/lib/navigation/search-state";
import { formatDate, formatNumber } from "@/lib/utils";
import { enviarRelatorioIndividualAction } from "../_actions";

export const dynamic = "force-dynamic";

async function safeDetailBlock<T>(label: string, frotaId: number, fallback: T, loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    console.error(`[frotas/${frotaId}] falha ao carregar ${label}`, error);
    return fallback;
  }
}

export default async function FrotaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const backHref = safeReturnTo(sp.returnTo) ?? "/frotas";
  const frotaId = Number.parseInt(id, 10);
  if (Number.isNaN(frotaId)) notFound();

  const user = await requireAdminUser();

  const frota = await getFrota(frotaId);
  if (!frota) notFound();

  const codigoFrota = frota.frota_geral ?? "";
  const documentsFilter = frota.frota_geral
    ? { frota: frota.frota_geral }
    : { placa: frota.placa ?? undefined };

  const [
    historico,
    kmHistorico,
    unidade,
    documentosResult,
    checklists,
    pendencias,
    abastecimentos,
    servicos,
    trocasPneus,
    eventos,
    sinistros,
  ] = await Promise.all([
    safeDetailBlock("historico completo", frotaId, [], () => listHistoricoCompleto(frotaId)),
    safeDetailBlock("historico de km", frotaId, [], () => listHistoricoKm(frotaId)),
    safeDetailBlock("unidade operacional", frotaId, null, () => findUnidadeForFrota(frota)),
    safeDetailBlock("documentos", frotaId, { rows: [], total: 0 }, () =>
      listDocuments({ ...documentsFilter, pageSize: 5 })
    ),
    safeDetailBlock("checklists", frotaId, [], () => listChecklistsByFrota(frotaId, 5)),
    safeDetailBlock("pendencias", frotaId, [], () => listPendenciasByFrota(frotaId, 8)),
    safeDetailBlock("abastecimentos", frotaId, [], () => listAbastecimentosFrota(frotaId, 5)),
    codigoFrota
      ? safeDetailBlock("servicos recentes", frotaId, [], () => listServicosByVeiculo(codigoFrota, 8))
      : [],
    codigoFrota
      ? safeDetailBlock("trocas de pneus", frotaId, [], () => listTrocasByVeiculo(codigoFrota, 5))
      : [],
    safeDetailBlock("eventos", frotaId, [], () => listEventosByVeiculo(frotaId, 50)),
    safeDetailBlock("sinistros", frotaId, [], () => listSinistrosByFrota(frotaId, 20)),
  ]);

  const kmData = kmHistorico.map((k) => ({
    date: new Date(k.alterado_em).toLocaleDateString("pt-BR"),
    km: Number(k.valor_novo) || 0,
  }));

  const pendenciasAbertas = pendencias.filter((item) =>
    ["ABERTA", "EM_TRATATIVA"].includes(item.status)
  );
  const ultimoChecklist = checklists[0] ?? null;
  const pneusTrocados = trocasPneus.reduce((sum, item) => sum + (item.trocas?.length ?? 0), 0);

  const tabs = [
    {
      id: "resumo",
      label: "Resumo",
      icon: "LayoutDashboard" as const,
      content: (
        <div className="space-y-5">
          <StatusOperacionalBanner
            frota={{
              id: frota.id,
              label: frota.frota_geral ?? frota.placa ?? `#${frota.id}`,
              status: frota.status,
              manutencao_motivo: frota.manutencao_motivo,
              manutencao_tipo: frota.manutencao_tipo,
              manutencao_oficina: frota.manutencao_oficina,
              manutencao_prev_retorno: frota.manutencao_prev_retorno,
              manutencao_observacao: frota.manutencao_observacao,
              manutencao_iniciado_em: frota.manutencao_iniciado_em,
              manutencao_iniciado_por: frota.manutencao_iniciado_por,
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <FuelGauge
              label="Nível combustível"
              nivel={frota.combustivel_atual_nivel}
              atualizadoEm={frota.combustivel_atualizado_em}
              origem={frota.combustivel_origem}
            />
            <FuelGauge
              label="Nível arla"
              nivel={frota.arla_atual_nivel}
              atualizadoEm={frota.arla_atualizado_em}
              origem={frota.arla_origem}
            />
          </div>

          <FrotaInfo frota={frota} />
          <UnidadeOperacionalCard unidade={unidade} />
        </div>
      ),
    },
    {
      id: "manutencao",
      label: "Manutenção",
      icon: "Wrench" as const,
      count: servicos.length,
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Serviços recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ServicosList rows={servicos} />
          </CardContent>
        </Card>
      ),
    },
    {
      id: "pneus",
      label: "Pneus",
      icon: "Truck" as const,
      count: pneusTrocados,
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trocas e número de fogo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <PneusList rows={trocasPneus} totalPneus={pneusTrocados} />
          </CardContent>
        </Card>
      ),
    },
    {
      id: "documentos",
      label: "Documentos",
      icon: "FileText" as const,
      count: documentosResult.total,
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos vinculados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DocumentsList rows={documentosResult.rows} total={documentosResult.total} />
          </CardContent>
        </Card>
      ),
    },
    {
      id: "checklist",
      label: "Checklists",
      icon: "ClipboardCheck" as const,
      count: pendenciasAbertas.length || null,
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checklists recentes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ChecklistsListClient rows={checklists} frotaId={frotaId} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pendências e alertas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <PendenciasList rows={pendencias} />
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: "abastecimentos",
      label: "Abastecimentos",
      icon: "Fuel" as const,
      count: abastecimentos.length,
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de abastecimentos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <AbastecimentosList rows={abastecimentos} />
          </CardContent>
        </Card>
      ),
    },
    {
      id: "historico",
      label: "Histórico",
      icon: "History" as const,
      count: eventos.length,
      content: (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eventos do veículo</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <EventsTimeline events={eventos} />
            </CardContent>
          </Card>
          <KmEvolutionChart data={kmData} />
          <HistoricoTimeline entries={historico} />
        </div>
      ),
    },
    {
      id: "sinistros",
      label: "Sinistros",
      icon: "ShieldAlert" as const,
      count: sinistros.length,
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sinistros e socorros</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <SinistrosList rows={sinistros} />
          </CardContent>
        </Card>
      ),
    },
  ];

  const idadeFrota = frota.ano_fabricacao
    ? new Date().getFullYear() - frota.ano_fabricacao
    : null;

  const heroTitle = frota.frota_geral ?? frota.placa ?? frota.chassi ?? `Frota #${frota.id}`;
  const heroEyebrow = `Visão 360º · ${frota.modelo ?? "Sem modelo"}`;
  const heroDescription = [
    frota.placa ? `Placa ${frota.placa}` : null,
    frota.localizacao,
    frota.setor ? `Setor ${frota.setor}` : null,
    frota.ano_fabricacao ? `${frota.ano_fabricacao} (${idadeFrota ?? "—"} anos)` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const checklistSeverity =
    ultimoChecklist?.status_geral === "APROVADO"
      ? "OK"
      : ultimoChecklist?.status_geral === "CRITICO"
        ? "CRITICO"
        : ultimoChecklist
          ? "ATENCAO"
          : "NEUTRO";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900">
          <Link href={backHref}>
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            Voltar
          </Link>
        </Button>
      </div>

      <PageHero
        eyebrow={heroEyebrow}
        title={heroTitle}
        description={heroDescription || undefined}
        icon={Truck}
        actions={
          <>
            {canEditFrota(user.perfil) && (
              <Button
                asChild
                variant="outline"
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white"
              >
                <Link href={`/frotas/${frota.id}/editar`}>
                  <Edit className="mr-1 h-4 w-4" aria-hidden="true" />
                  Editar
                </Link>
              </Button>
            )}
            <EnviarRelatorioDialog
              title={`Enviar relatório de ${frota.placa ?? frota.id}`}
              action={enviarRelatorioIndividualAction.bind(null, frota.id)}
              triggerLabel="Enviar e-mail"
              triggerVariant="outline"
              triggerClassName="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white"
            />
          </>
        }
      >
        <HeroStat
          label="KM atual"
          value={formatNumber(frota.km_atual)}
          hint={frota.km_atualizado_em ? `Atualizado ${formatDate(frota.km_atualizado_em)}` : "Sem data"}
          icon={Gauge}
          severity="INFO"
        />
        <HeroStat
          label="Último checklist"
          value={ultimoChecklist?.status_geral?.replace(/_/g, " ") ?? "—"}
          hint={ultimoChecklist ? formatDate(ultimoChecklist.data_checklist) : "Sem checklist"}
          icon={ClipboardCheck}
          severity={checklistSeverity}
        />
        <HeroStat
          label="Pendências abertas"
          value={pendenciasAbertas.length}
          hint={pendenciasAbertas[0]?.item_nome ?? "Sem pendências"}
          icon={AlertTriangle}
          severity={pendenciasAbertas.length > 0 ? "CRITICO" : "OK"}
        />
        <HeroStat
          label="Combustível"
          value={
            frota.combustivel_atual_nivel != null
              ? `${Math.min(100, Math.max(0, Math.round(frota.combustivel_atual_nivel * 25)))}%`
              : "—"
          }
          hint={
            frota.combustivel_atualizado_em
              ? `${frota.combustivel_atual_nivel ?? 0}/4 · ${formatDate(frota.combustivel_atualizado_em)}`
              : "Sem leitura"
          }
          icon={Fuel}
          severity={
            frota.combustivel_atual_nivel == null
              ? "NEUTRO"
              : frota.combustivel_atual_nivel <= 1
                ? "CRITICO"
                : frota.combustivel_atual_nivel <= 2
                  ? "ATENCAO"
                  : "OK"
          }
        />
      </PageHero>

      <VeiculoTabs tabs={tabs} />
    </div>
  );
}

function DocumentsList({ rows, total }: { rows: DocumentRecordWithSignedUrls[]; total: number }) {
  if (rows.length === 0)
    return (
      <div className="p-4">
        <EmptyState icon={FileText} title="Sem documentos" description="Nenhum documento vinculado a esta frota." />
      </div>
    );
  return (
    <div className="divide-y">
      {rows.map((doc) => (
        <div key={doc.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="font-semibold text-slate-950">Frota {doc.frota}</div>
            <div className="text-sm text-muted-foreground">
              {doc.placa} · {doc.modelo}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <DocumentBadge label="DUT" href={doc.dut_signed_url} />
            <DocumentBadge label="CRLV" href={doc.crlv_signed_url} />
          </div>
        </div>
      ))}
      {total > rows.length ? (
        <div className="p-3 text-xs text-muted-foreground">
          Mais {total - rows.length} registro(s) no módulo de documentos.
        </div>
      ) : null}
    </div>
  );
}

function DocumentBadge({ label, href }: { label: string; href: string | null }) {
  if (!href) return <Badge variant="outline">{label}: pendente</Badge>;
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    </Button>
  );
}

function PneusList({
  rows,
  totalPneus,
}: {
  rows: Array<ServicoApp & { trocas: TrocaPneuApp[] }>;
  totalPneus: number;
}) {
  if (rows.length === 0)
    return (
      <div className="p-4">
        <EmptyState icon={Truck} title="Sem trocas registradas" />
      </div>
    );
  return (
    <div className="divide-y">
      <div className="p-4 text-sm text-muted-foreground">
        {totalPneus} pneu(s) movimentado(s) nas trocas recentes.
      </div>
      {rows.map((servico) => (
        <div key={servico.id_servico} className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold text-slate-950">{formatDate(servico.data_servico)}</div>
            <Badge variant="outline">KM {formatNumber(servico.quilometragem)}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {servico.trocas.map((troca) => (
              <Badge key={`${servico.id_servico}-${troca.id}`} variant="outline">
                {troca.posicao}: {troca.numero_fogo ?? "sem número"}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ServicosList({ rows }: { rows: ServicoApp[] }) {
  if (rows.length === 0)
    return (
      <div className="p-4">
        <EmptyState icon={Wrench} title="Sem serviços recentes" />
      </div>
    );
  return (
    <div className="divide-y">
      {rows.map((servico) => (
        <div key={servico.id_servico} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="font-semibold capitalize text-slate-950">
              {servico.tipo_servico.replaceAll("_", " ")}
            </div>
            <div className="text-sm text-muted-foreground">{servico.observacoes ?? "Sem observação"}</div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>{formatDate(servico.data_servico)}</div>
            <div>KM {formatNumber(servico.quilometragem)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PendenciasList({ rows }: { rows: Awaited<ReturnType<typeof listPendenciasByFrota>> }) {
  if (rows.length === 0)
    return (
      <div className="p-4">
        <EmptyState icon={AlertTriangle} title="Sem pendências" />
      </div>
    );
  return (
    <div className="divide-y">
      {rows.map((pendencia) => (
        <div key={pendencia.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-950">{pendencia.item_nome}</div>
              <div className="text-sm text-muted-foreground">
                {formatDate(pendencia.criado_em)} ·{" "}
                {pendencia.motorista_nome ?? pendencia.motorista_id ?? "sistema"}
              </div>
            </div>
            <StatusBadge status={pendencia.status} />
          </div>
          <Badge variant="outline" className="mt-2">
            {pendencia.gravidade}
          </Badge>
        </div>
      ))}
    </div>
  );
}

const SINISTRO_TIPO_LABELS: Record<SinistroRow["tipo_sinistro"], string> = {
  veiculo: "Acidente com veículo",
  casa: "Acidente com casas",
  socorro: "Socorro",
};

function SinistrosList({ rows }: { rows: SinistroRow[] }) {
  if (rows.length === 0)
    return (
      <div className="p-4">
        <EmptyState icon={ShieldAlert} title="Sem sinistros registrados" />
      </div>
    );
  return (
    <div className="divide-y">
      {rows.map((sinistro) => (
        <div key={sinistro.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-950">
                {sinistro.ticket_number} · {SINISTRO_TIPO_LABELS[sinistro.tipo_sinistro]}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDate(sinistro.criado_em)} · {sinistro.motorista_nome ?? sinistro.motorista_id}
              </div>
            </div>
            <StatusBadge status={sinistro.status} />
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-slate-700">{sinistro.descricao}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sinistro.houve_feridos && (
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                Feridos
              </Badge>
            )}
            {sinistro.precisa_guincho && (
              <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                Guincho
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AbastecimentosList({ rows }: { rows: Awaited<ReturnType<typeof listAbastecimentosFrota>> }) {
  if (rows.length === 0)
    return (
      <div className="p-4">
        <EmptyState icon={Fuel} title="Sem abastecimentos registrados" />
      </div>
    );
  return (
    <div className="divide-y">
      {rows.map((item) => (
        <div key={item.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="font-semibold text-slate-950">{item.tipo_combustivel ?? "Abastecimento"}</div>
            <div className="text-sm text-muted-foreground">
              {item.motorista_nome ?? item.motorista_id ?? item.origem}
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>{formatDate(item.data_hora)}</div>
            <div>
              {formatNumber(item.litros_combustivel)} L · Arla {formatNumber(item.litros_arla)} L
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
