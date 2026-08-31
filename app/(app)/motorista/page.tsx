import Link from "next/link";
import { AlertTriangle, ClipboardCheck, ClipboardList, Fuel, History, Home, ShieldAlert, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listDriverChecklists } from "@/lib/repos/checklists";
import { listAtividadesPendentesPorMotorista } from "@/lib/repos/atividades-manutencao";
import { requireAppUser } from "@/lib/rbac";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MotoristaHomePage() {
  const user = await requireAppUser();
  const isInterno = user.perfil === "MOTORISTA_INTERNO";

  const [ultimos, atividadesPendentes] = await Promise.all([
    listDriverChecklists(user.email, 5),
    isInterno ? listAtividadesPendentesPorMotorista(user.email) : Promise.resolve([]),
  ]);
  const fezChecklistHoje = ultimos.some((checklist) => formatDate(checklist.data_checklist) === formatDate(new Date()));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        eyebrow={`Hoje · ${formatDate(new Date())}`}
        title={`Bem-vindo, ${user.name}`}
        description={
          isInterno
            ? `${atividadesPendentes.length} atividade(s) pendente(s).`
            : fezChecklistHoje ? "Checklist do dia já registrado." : "Registre o checklist antes de iniciar o uso da frota."
        }
        icon={Home}
        severity={isInterno ? (atividadesPendentes.length > 0 ? "ATENCAO" : "OK") : fezChecklistHoje ? "OK" : "ATENCAO"}
      />

      {isInterno ? (
        <Card className="rounded-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="h-5 w-5 text-blue-700" aria-hidden="true" />
              Atividades pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {atividadesPendentes.length > 0 ? (
              <div className="space-y-2">
                <p className="text-3xl font-bold tabular-nums">{atividadesPendentes.length}</p>
                <Button asChild size="lg" className="h-12">
                  <Link href="/motorista/atividades">
                    <ClipboardList className="h-4 w-4" aria-hidden="true" />
                    Ver atividades
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma atividade pendente no momento.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {!fezChecklistHoje ? (
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <AlertTriangle className="mt-0.5 h-5 w-5" aria-hidden="true" />
              <div className="text-sm">
                <div className="font-semibold">Checklist do dia pendente</div>
                <p>Registre a vistoria antes de iniciar o uso da frota.</p>
              </div>
            </div>
          ) : null}

          <Card className="rounded-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-center gap-2 text-xl">
                <Truck className="h-5 w-5 text-blue-700" aria-hidden="true" />
                Escolha sua frota
              </CardTitle>
            </CardHeader>
            <CardContent className="mx-auto flex max-w-xs flex-col gap-2">
              <Button asChild size="lg" className="h-12">
                <Link href="/motorista/checklist">
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  Fazer checklist agora
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/motorista/checklists">
                  <History className="h-4 w-4" aria-hidden="true" />
                  Meus últimos checklists
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/motorista/sinistro">
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  Reportar sinistro
                </Link>
              </Button>
              <span title="Abastecimento registrado diretamente no checklist" className="cursor-not-allowed">
                <Button variant="outline" disabled className="pointer-events-none w-full">
                  <Fuel className="h-4 w-4" aria-hidden="true" />
                  Registrar abastecimento
                </Button>
              </span>
            </CardContent>
          </Card>
        </>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico rápido</h2>
        <div className="grid gap-3">
          {ultimos.length > 0 ? (
            ultimos.map((checklist) => (
              <Link
                key={checklist.id}
                href="/motorista/checklists"
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-white p-3 shadow-sm hover:bg-blue-50"
              >
                <div>
                  <div className="font-medium">
                    {formatDate(checklist.data_checklist)} - {checklist.frota_geral ?? checklist.placa ?? "Frota"}
                  </div>
                  <div className="text-sm text-muted-foreground">KM {formatNumber(checklist.km_informado)}</div>
                </div>
                <Badge variant="outline">{checklist.status_geral}</Badge>
              </Link>
            ))
          ) : (
            <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground">Nenhum checklist registrado.</div>
          )}
        </div>
      </section>
    </div>
  );
}
