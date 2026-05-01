import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Edit, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteFrotaButton } from "@/components/frotas/delete-frota-button";
import { FrotaInfo } from "@/components/frotas/frota-info";
import { HistoricoTimeline } from "@/components/frotas/historico-timeline";
import { KmEvolutionChart } from "@/components/frotas/km-evolution-chart";
import { EnviarRelatorioDialog } from "@/components/relatorios/enviar-relatorio-dialog";
import { getFrota } from "@/lib/repos/frotas";
import { listHistorico, listHistoricoKm } from "@/lib/repos/historico";
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

  const [historico, kmHistorico] = await Promise.all([
    listHistorico(frotaId),
    listHistoricoKm(frotaId),
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
            title={`Enviar relatorio de ${frota.placa ?? frota.id}`}
            action={enviarRelatorioIndividualAction.bind(null, frota.id)}
            trigger={
              <Button variant="outline">
                <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                Enviar e-mail
              </Button>
            }
          />
          <DeleteFrotaButton id={frota.id} label={frota.placa ?? frota.chassi ?? `#${frota.id}`} />
        </div>
      </div>
      <FrotaInfo frota={frota} />
      <KmEvolutionChart data={kmData} />
      <HistoricoTimeline entries={historico} />
    </div>
  );
}
