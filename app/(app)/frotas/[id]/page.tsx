import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteFrotaButton } from "@/components/frotas/delete-frota-button";
import { FrotaInfo } from "@/components/frotas/frota-info";
import { HistoricoTimeline } from "@/components/frotas/historico-timeline";
import { KmEvolutionChart } from "@/components/frotas/km-evolution-chart";
import { UnidadeOperacionalCard } from "@/components/frotas/unidade-operacional-card";
import { EnviarRelatorioDialog } from "@/components/relatorios/enviar-relatorio-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getFrota } from "@/lib/repos/frotas";
import { listHistoricoCompleto, listHistoricoKm } from "@/lib/repos/historico";
import { findUnidadeForFrota } from "@/lib/repos/unidades";
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

  const [historico, kmHistorico, unidade] = await Promise.all([
    listHistoricoCompleto(frotaId),
    listHistoricoKm(frotaId),
    findUnidadeForFrota(frota),
  ]);
  const kmData = kmHistorico.map((k) => ({
    date: new Date(k.alterado_em).toLocaleDateString("pt-BR"),
    km: Number(k.valor_novo) || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Voltar">
            <Link href="/frotas">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {frota.placa ?? frota.chassi ?? `Frota #${frota.id}`}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/frotas/${frota.id}/editar`}>
              <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
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

      <FrotaInfo frota={frota} />

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-4">
          <ResumoField
            label="KM atual"
            value={formatNumber(frota.km_atual)}
            extra={
              frota.km_validado === false ? (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
                  Pendente validação
                </Badge>
              ) : null
            }
            sub={frota.km_atualizado_em ? `Atualizado em ${formatDate(frota.km_atualizado_em)}` : null}
          />
          <ResumoField
            label="Último checklist"
            value={frota.ultimo_checklist_em ? formatDate(frota.ultimo_checklist_em) : "-"}
            sub={frota.ultimo_motorista_nome ?? frota.ultimo_motorista_id ?? null}
          />
          <ResumoField
            label="Último abastecimento"
            value={
              frota.ultimo_abastecimento_litros != null
                ? `${formatNumber(frota.ultimo_abastecimento_litros)} L`
                : "-"
            }
            sub={frota.ultimo_abastecimento_em ? formatDate(frota.ultimo_abastecimento_em) : null}
          />
          <ResumoField
            label="Status operacional"
            value={frota.status_operacional ?? "-"}
            extra={
              frota.status_operacional === "BLOQUEADA_CHECKLIST" ? (
                <Badge className="border-transparent bg-red-600 text-white hover:bg-red-600">Bloqueada</Badge>
              ) : frota.status_operacional === "PENDENTE_ANALISE" ? (
                <Badge className="border-transparent bg-amber-500 text-white hover:bg-amber-500">Pendente</Badge>
              ) : frota.status_operacional === "LIBERADA" ? (
                <Badge className="border-transparent bg-emerald-600 text-white hover:bg-emerald-600">Liberada</Badge>
              ) : null
            }
          />
        </CardContent>
      </Card>

      <UnidadeOperacionalCard unidade={unidade} />
      <KmEvolutionChart data={kmData} />
      <HistoricoTimeline entries={historico} />
    </div>
  );
}

function ResumoField({
  label,
  value,
  sub,
  extra,
}: {
  label: string;
  value: string;
  sub?: string | null;
  extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <div className="text-lg font-semibold tabular-nums text-slate-950">{value}</div>
        {extra}
      </div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
