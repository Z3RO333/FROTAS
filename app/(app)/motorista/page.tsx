import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Fuel, History, Home, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listDriverChecklists } from "@/lib/repos/checklists";
import { listFrotas } from "@/lib/repos/frotas";
import { requireAppUser } from "@/lib/rbac";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MotoristaHomePage() {
  const user = await requireAppUser();
  const [{ rows: frotas }, ultimos] = await Promise.all([
    listFrotas({ pageSize: 1 }),
    listDriverChecklists(user.email, 5),
  ]);
  const frota = frotas[0] ?? null;
  const fezChecklistHoje = ultimos.some((checklist) => formatDate(checklist.data_checklist) === formatDate(new Date()));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        eyebrow={`Hoje · ${formatDate(new Date())}`}
        title={`Bem-vindo, ${user.name}`}
        description={fezChecklistHoje ? "Checklist do dia já registrado." : "Registre o checklist antes de iniciar o uso da frota."}
        icon={Home}
        severity={fezChecklistHoje ? "OK" : "ATENCAO"}
      />

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
          <CardTitle className="flex items-center gap-2 text-xl">
            <Truck className="h-5 w-5 text-blue-700" aria-hidden="true" />
            Sua frota atual
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_220px]">
          {frota ? (
            <>
              <Link href="/motorista/checklist" className="rounded-md border bg-slate-50 p-4 transition-colors hover:bg-blue-50">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold">{frota.frota_geral ?? `Frota #${frota.id}`}</h2>
                  <Badge variant="outline">{frota.status ?? "disponível"}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <Info label="Modelo" value={frota.modelo} />
                  <Info label="Placa" value={frota.placa} />
                  <Info label="Setor" value={frota.localizacao} />
                  <Info label="Último KM" value={formatNumber(frota.km_atual)} />
                </div>
              </Link>
              <div className="flex flex-col gap-2">
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
                <span title="Abastecimento registrado diretamente no checklist" className="cursor-not-allowed">
                  <Button variant="outline" disabled className="pointer-events-none w-full">
                    <Fuel className="h-4 w-4" aria-hidden="true" />
                    Registrar abastecimento
                  </Button>
                </span>
              </div>
            </>
          ) : (
            <div className="md:col-span-2 space-y-1 rounded-md border bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">Nenhuma frota atribuída</p>
              <p className="text-xs text-muted-foreground">Você ainda não tem uma frota designada. Aguarde a atribuição pelo administrador ou entre em contato com a equipe de operação.</p>
            </div>
          )}
        </CardContent>
      </Card>

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

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="block text-xs uppercase text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "-"}</span>
    </div>
  );
}
