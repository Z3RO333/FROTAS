import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, FileText, RefreshCw } from "lucide-react";
import { BemolTruck } from "@/components/frotas/bemol-truck";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Kpis } from "@/lib/repos/frotas";
import { formatNumber } from "@/lib/utils";

type Props = {
  kpis: Kpis;
  reportDialog: ReactNode;
};

export function CockpitSummary({ kpis, reportDialog }: Props) {
  const attentionTotal = kpis.total_atencao + kpis.total_critico;
  const attentionCopy =
    attentionTotal > 0
      ? `${formatNumber(attentionTotal)} de ${formatNumber(
          kpis.total_ativos
        )} frota(s) exigem atencao operacional por idade, status base ou cadastro incompleto.`
      : `Nenhuma das ${formatNumber(kpis.total_ativos)} frota(s) exige atencao operacional agora.`;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
      <Card className="overflow-hidden border-blue-100 bg-white">
        <CardContent className="grid gap-6 p-5 lg:grid-cols-[260px_1fr] lg:items-center">
          <BemolTruck className="mx-auto" priority />
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-700">
                Operacao em tempo real
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                {formatNumber(kpis.total_disponiveis)} de {formatNumber(kpis.total_ativos)} frotas disponiveis
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {attentionCopy}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {reportDialog}
              <Button variant="outline" asChild>
                <Link href="/frotas?cadastro=incompleto">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Revisar cadastros
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Atualizar dados
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-slate-950 text-white">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            Lista de acao
          </div>
          <div className="space-y-3">
            <ActionLink href="/frotas?semKm=1" label="Sem KM informado" value={kpis.total_sem_km} />
            <ActionLink href="/frotas?idadeMin=7" label="Acima de 7 anos" value={kpis.total_acima_7} />
            <ActionLink
              href="/frotas?cadastro=incompleto"
              label="Cadastro incompleto"
              value={kpis.total_cadastro_incompleto}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActionLink({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm transition-colors hover:bg-white/10"
    >
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{formatNumber(value)}</span>
    </Link>
  );
}
