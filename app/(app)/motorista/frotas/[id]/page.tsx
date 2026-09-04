import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ClipboardCheck, Gauge, History, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMotoristaUser } from "@/lib/rbac";
import { getFrotasDoMotorista } from "@/lib/repos/motoristas";
import { listDriverChecklists } from "@/lib/repos/checklists";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MotoristaFrotaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireMotoristaUser();
  const { id: rawId } = await params;
  const frotaId = Number(rawId);
  if (!Number.isInteger(frotaId) || frotaId <= 0) notFound();

  const [frotas, checklists] = await Promise.all([
    getFrotasDoMotorista(user.email),
    listDriverChecklists(user.email, 50),
  ]);
  const frota = frotas.find((item) => item.frota_id === frotaId);
  if (!frota) notFound();
  const checklistsDaFrota = checklists.filter((item) => item.frota_id === frotaId);
  const ultimo = checklistsDaFrota[0];

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <PageHeader
        eyebrow="Meu histórico"
        title={`Frota ${frota.frota_geral ?? frota.frota_id}`}
        description={[frota.placa, frota.modelo].filter(Boolean).join(" · ") || "Veículo utilizado"}
        icon={Truck}
        severity="INFO"
        actions={
          <Button asChild variant="outline">
            <Link href="/motorista/historico">
              <ArrowLeft aria-hidden="true" /> Voltar ao histórico
            </Link>
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={<History />} label="Movimentações" value={formatNumber(frota.qtd_movimentacoes)} />
        <Metric icon={<ClipboardCheck />} label="Checklists" value={formatNumber(checklistsDaFrota.length)} />
        <Metric icon={<CalendarClock />} label="Última utilização" value={frota.ultima_vez ? formatDate(frota.ultima_vez) : "—"} />
        <Metric icon={<Gauge />} label="Último KM" value={ultimo?.km_informado != null ? formatNumber(ultimo.km_informado) : "—"} />
      </section>

      <Card>
        <CardContent className="p-0">
          <div className="border-b bg-slate-50 px-4 py-3">
            <h2 className="font-semibold text-slate-950">Checklists realizados por você</h2>
            <p className="text-xs text-slate-500">Somente registros desta frota e do seu usuário.</p>
          </div>
          {checklistsDaFrota.length > 0 ? (
            <div className="divide-y">
              {checklistsDaFrota.map((checklist) => (
                <article key={checklist.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{formatDate(checklist.data_checklist)}</p>
                    <p className="text-sm text-slate-500">KM {formatNumber(checklist.km_informado)}</p>
                  </div>
                  <span className="w-fit rounded-full border bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {statusLabel(checklist.status_geral)}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="p-6 text-center text-sm text-slate-500">Nenhum checklist seu encontrado para esta frota.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-blue-700 [&>svg]:h-4 [&>svg]:w-4">{icon}</div>
      <p className="mt-3 text-xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function statusLabel(status: string): string {
  if (status === "APROVADO") return "Aprovado";
  if (status === "COM_OBSERVACAO") return "Com observação";
  if (status === "CRITICO") return "Crítico";
  if (status === "NAO_APTO") return "Não apto";
  return status;
}
