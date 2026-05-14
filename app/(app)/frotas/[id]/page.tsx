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
  Truck,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteFrotaButton } from "@/components/frotas/delete-frota-button";
import { FrotaInfo } from "@/components/frotas/frota-info";
import { HistoricoTimeline } from "@/components/frotas/historico-timeline";
import { KmEvolutionChart } from "@/components/frotas/km-evolution-chart";
import { UnidadeOperacionalCard } from "@/components/frotas/unidade-operacional-card";
import { VeiculoTabs } from "@/components/frotas/veiculo-360/tabs";
import { EventsTimeline } from "@/components/frotas/veiculo-360/events-timeline";
import { EnviarRelatorioDialog } from "@/components/relatorios/enviar-relatorio-dialog";
import { listAbastecimentosFrota } from "@/lib/repos/abastecimentos";
import { listChecklistsByFrota, listPendenciasByFrota } from "@/lib/repos/checklists";
import { getFrota } from "@/lib/repos/frotas";
import { listHistoricoCompleto, listHistoricoKm } from "@/lib/repos/historico";
import { listDocuments } from "@/lib/repos/manutencao/documents";
import { listTrocasByVeiculo } from "@/lib/repos/manutencao/pneus";
import { listServicosByVeiculo } from "@/lib/repos/manutencao/servicos";
import type { DocumentRecordWithSignedUrls, ServicoApp, TrocaPneuApp } from "@/lib/repos/manutencao/types";
import { findUnidadeForFrota } from "@/lib/repos/unidades";
import { listEventosByVeiculo } from "@/lib/services/veiculo-eventos";
import { formatDate, formatNumber } from "@/lib/utils";
import { enviarRelatorioIndividualAction } from "../_actions";

export const dynamic = "force-dynamic";

export default async function FrotaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const frotaId = Number.parseInt(id, 10);
  if (Number.isNaN(frotaId)) notFound();

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
  ] = await Promise.all([
    listHistoricoCompleto(frotaId),
    listHistoricoKm(frotaId),
    findUnidadeForFrota(frota),
    listDocuments({ ...documentsFilter, pageSize: 5 }).catch(() => ({ rows: [], total: 0 })),
    listChecklistsByFrota(frotaId, 5),
    listPendenciasByFrota(frotaId, 8),
    listAbastecimentosFrota(frotaId, 5).catch(() => []),
    codigoFrota ? listServicosByVeiculo(codigoFrota, 8).catch(() => []) : [],
    codigoFrota ? listTrocasByVeiculo(codigoFrota, 5).catch(() => []) : [],
    listEventosByVeiculo(frotaId, 50).catch(() => []),
  ]);

  const kmData = kmHistorico.map((k) => ({
    date: new Date(k.alterado_em).toLocaleDateString("pt-BR"),
    km: Number(k.valor_novo) || 0,
  }));

  const pendenciasAbertas = pendencias.filter((item) =>
    ["ABERTA", "EM_TRATATIVA"].includes(item.status)
  );
  const ultimoChecklist = checklists[0] ?? null;
  const documentosCompletos = documentosResult.rows.filter((doc) => doc.dut_url && doc.crlv_url).length;
  const pneusTrocados = trocasPneus.reduce((sum, item) => sum + (item.trocas?.length ?? 0), 0);

  const f = frota as typeof frota & {
    combustivel_atual_litros?: number | null;
    combustivel_atual_nivel?: number | null;
    combustivel_atualizado_em?: string | null;
    combustivel_origem?: string | null;
  };
  const combustivelNivel = f.combustivel_atual_nivel ?? null;

  const tabs = [
    {
      id: "resumo",
      label: "Resumo",
      content: (
        <div className="space-y-5">
          <MetricGrid cols={4}>
            <MetricCard
              label="KM atual"
              value={formatNumber(frota.km_atual)}
              icon={Gauge}
              severity="INFO"
              hint={frota.km_atualizado_em ? `Atualizado em ${formatDate(frota.km_atualizado_em)}` : "Sem data"}
            />
            <MetricCard
              label="Combustível"
              value={
                f.combustivel_atual_litros != null
                  ? `${formatNumber(f.combustivel_atual_litros)} L`
                  : combustivelNivel != null
                    ? `${combustivelNivel}/4`
                    : "—"
              }
              icon={Fuel}
              severity="NEUTRO"
              hint={f.combustivel_atualizado_em ? `${f.combustivel_origem ?? "checklist"} · ${formatDate(f.combustivel_atualizado_em)}` : "Sem leitura"}
            />
            <MetricCard
              label="Último checklist"
              value={ultimoChecklist?.status_geral?.replace(/_/g, " ") ?? "—"}
              icon={ClipboardCheck}
              severity={
                ultimoChecklist?.status_geral === "APROVADO"
                  ? "OK"
                  : ultimoChecklist?.status_geral === "CRITICO"
                    ? "CRITICO"
                    : "ATENCAO"
              }
              hint={ultimoChecklist ? formatDate(ultimoChecklist.data_checklist) : "Sem checklist"}
            />
            <MetricCard
              label="Pendências"
              value={pendenciasAbertas.length}
              icon={AlertTriangle}
              severity={pendenciasAbertas.length > 0 ? "CRITICO" : "OK"}
              hint={pendenciasAbertas[0]?.item_nome ?? "Sem pendências"}
            />
          </MetricGrid>

          <FrotaInfo frota={frota} />
          <UnidadeOperacionalCard unidade={unidade} />
        </div>
      ),
    },
    {
      id: "manutencao",
      label: "Manutenção",
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
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checklists recentes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ChecklistsList rows={checklists} />
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
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Voltar">
            <Link href="/frotas">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">
              Visão 360º do veículo
            </div>
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {frota.frota_geral ?? frota.placa ?? frota.chassi ?? `Frota #${frota.id}`}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {frota.placa ?? "—"} · {frota.modelo ?? "Sem modelo"} · {frota.localizacao ?? "Sem setor"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/frotas/${frota.id}/editar`}>
              <Edit className="mr-1 h-4 w-4" aria-hidden="true" />
              Editar
            </Link>
          </Button>
          <EnviarRelatorioDialog
            title={`Enviar relatório de ${frota.placa ?? frota.id}`}
            action={enviarRelatorioIndividualAction.bind(null, frota.id)}
            triggerLabel="Enviar e-mail"
            triggerVariant="outline"
          />
          <DeleteFrotaButton id={frota.id} label={frota.placa ?? frota.chassi ?? `#${frota.id}`} />
        </div>
      </div>

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

function ChecklistsList({ rows }: { rows: Awaited<ReturnType<typeof listChecklistsByFrota>> }) {
  if (rows.length === 0)
    return (
      <div className="p-4">
        <EmptyState icon={ClipboardCheck} title="Sem checklists" />
      </div>
    );
  return (
    <div className="divide-y">
      {rows.map((checklist) => (
        <div key={checklist.id} className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold text-slate-950">{formatDate(checklist.data_checklist)}</div>
            <StatusBadge status={checklist.status_geral} />
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {checklist.motorista_nome ?? checklist.motorista_id} · KM{" "}
            {formatNumber(checklist.km_informado)}
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
