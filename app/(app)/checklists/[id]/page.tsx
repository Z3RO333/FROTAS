import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  ImageIcon,
  MessageSquare,
  Truck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAdminUser } from "@/lib/rbac";
import { getChecklistDetalhePortaria } from "@/lib/repos/portaria-detail";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ChecklistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser();
  const { id: rawId } = await params;
  const checklistId = Number(rawId);
  if (!Number.isInteger(checklistId) || checklistId <= 0) notFound();

  const detalhe = await getChecklistDetalhePortaria(checklistId);
  if (!detalhe) notFound();

  const problemas = detalhe.itens.filter((item) => item.status === "NAO_APTO");
  const aprovados = detalhe.itens.filter((item) => item.status === "APTO");
  const naoAplicaveis = detalhe.itens.filter((item) => item.status === "NAO_SE_APLICA");
  const fotoHodometro = detalhe.fotos.find((foto) => foto.source_type === "hodometro");
  const observacao = detalhe.observacao_corrigida_ia?.trim() || detalhe.observacao_original?.trim();

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Vistoria operacional"
        title={`Checklist #${detalhe.checklist_id}`}
        description={`Frota ${detalhe.frota_geral ?? detalhe.frota_id} · ${formatDate(detalhe.criado_em)}`}
        icon={ClipboardCheck}
        severity={detalhe.status_geral === "CRITICO" ? "CRITICO" : detalhe.status_geral === "APROVADO" ? "OK" : "ATENCAO"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/checklists">
                <ArrowLeft aria-hidden="true" /> Voltar aos checklists
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/frotas/${detalhe.frota_id}`}>
                <Truck aria-hidden="true" /> Abrir frota
              </Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo do checklist">
        <SummaryCard label="Status">
          <StatusBadge status={detalhe.status_geral ?? ""} size="md" />
        </SummaryCard>
        <SummaryCard label="Motorista" icon={<User />}>
          {detalhe.motorista_nome ?? detalhe.motorista_id ?? "Não informado"}
        </SummaryCard>
        <SummaryCard label="Quilometragem" icon={<Gauge />}>
          {formatNumber(detalhe.km_informado)} km
        </SummaryCard>
        <SummaryCard label="Veículo" icon={<Truck />}>
          <span>{detalhe.placa ?? "Sem placa"}</span>
          {detalhe.modelo ? <span className="block text-xs font-normal text-slate-500">{detalhe.modelo}</span> : null}
        </SummaryCard>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {problemas.length > 0 ? (
            <Card className="overflow-hidden border-red-200">
              <CardHeader className="border-b border-red-100 bg-red-50/70">
                <CardTitle className="flex items-center gap-2 text-base text-red-900">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  Não conformidades ({problemas.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {problemas.map((item) => {
                  const foto = detalhe.fotos.find((entry) => entry.checklist_item_codigo === item.item_codigo);
                  return (
                    <article key={item.id} className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:p-5">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-slate-950">{item.item_nome}</h2>
                          {item.critico ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">Crítico</span>
                          ) : null}
                          {item.obrigatorio ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Obrigatório</span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {item.observacao?.trim() || "Problema marcado sem observação adicional."}
                        </p>
                      </div>
                      {foto?.signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={foto.signed_url} alt={`Evidência de ${item.item_nome}`} className="h-32 w-full rounded-lg border bg-slate-50 object-cover" />
                      ) : (
                        <div className="flex h-24 items-center justify-center gap-2 rounded-lg border border-dashed bg-slate-50 text-xs text-slate-400 sm:h-32">
                          <ImageIcon className="h-4 w-4" aria-hidden="true" /> Sem foto
                        </div>
                      )}
                    </article>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
              <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">Nenhuma não conformidade</p>
                <p className="text-sm text-emerald-800">Todos os itens aplicáveis foram aprovados.</p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="border-b bg-slate-50/70">
              <CardTitle className="text-base">Itens verificados</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 p-4 sm:grid-cols-2">
              {aprovados.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span className="min-w-0 truncate">{item.item_nome}</span>
                </div>
              ))}
              {naoAplicaveis.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                  <span className="min-w-0 truncate">{item.item_nome} · não se aplica</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          {fotoHodometro?.signed_url ? (
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-slate-50/70 py-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Gauge className="h-4 w-4 text-blue-600" aria-hidden="true" /> Foto do hodômetro
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fotoHodometro.signed_url} alt="Foto do hodômetro" className="max-h-80 w-full rounded-lg bg-slate-50 object-contain" />
              </CardContent>
            </Card>
          ) : null}

          {observacao ? (
            <Card>
              <CardHeader className="border-b bg-slate-50/70 py-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4 text-blue-600" aria-hidden="true" /> Observações
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-sm leading-6 text-slate-700">{observacao}</CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="border-b bg-slate-50/70 py-4">
              <CardTitle className="text-sm">Identificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 text-sm">
              <Detail label="Checklist" value={`#${detalhe.checklist_id}`} />
              <Detail label="Frota" value={detalhe.frota_geral ?? String(detalhe.frota_id)} />
              <Detail label="Data e hora" value={formatDateTime(detalhe.criado_em)} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SummaryCard({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {icon ? <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span> : null}
        {label}
      </p>
      <div className="mt-2 font-semibold text-slate-950">{children}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus",
  }).format(new Date(value));
}
