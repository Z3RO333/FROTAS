import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, PackageSearch, RefreshCw, Truck } from "lucide-react";
import { PedidoPecasStatusBadge } from "@/components/manutencao/pedido-pecas-status";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getPedidoPecas } from "@/lib/repos/pedidos-pecas";
import { requireManutencaoUser } from "@/lib/rbac";
import { reenviarCotacoesPedidoPecasAction } from "../_actions";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus",
  }).format(new Date(value));
}

export default async function PedidoPecasDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resultado?: string }>;
}) {
  await requireManutencaoUser();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [pedido, query] = await Promise.all([getPedidoPecas(id), searchParams]);
  if (!pedido) notFound();
  const podeReenviar = pedido.envios.some((envio) => envio.status !== "ENVIADO");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pedido de peças"
        title={pedido.codigo}
        description={`Criado em ${formatDateTime(pedido.criado_em)} por ${pedido.solicitante_nome}.`}
        icon={PackageSearch}
        severity="INFO"
        actions={
          <Button asChild variant="outline">
            <Link href="/manutencao/pecas">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar
            </Link>
          </Button>
        }
      />

      {query.resultado === "enviado" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Cotação enviada separadamente aos três fornecedores.
        </div>
      ) : query.resultado === "parcial" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Parte das cotações foi enviada. Os destinatários pendentes podem ser reenviados abaixo.
        </div>
      ) : query.resultado === "erro" ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          O pedido foi registrado, mas o envio não foi concluído. Verifique os destinatários abaixo.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <PedidoPecasStatusBadge status={pedido.status} />
        {podeReenviar ? (
          <form action={reenviarCotacoesPedidoPecasAction}>
            <input type="hidden" name="pedido_id" value={pedido.id} />
            <Button type="submit">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reenviar pendentes
            </Button>
          </form>
        ) : null}
      </div>

      <section className="space-y-3">
        <SectionHeader title="Veículo" />
        <div className="grid gap-px overflow-hidden rounded-md border bg-slate-200 sm:grid-cols-2 lg:grid-cols-5">
          <Detail label="Frota" value={pedido.frota_codigo} icon={<Truck className="h-3.5 w-3.5" />} />
          <Detail label="Placa" value={pedido.placa} />
          <Detail label="Modelo / Marca" value={pedido.modelo} />
          <Detail label="Chassi" value={pedido.chassi} />
          <Detail label="Ano" value={pedido.ano_fabricacao} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title={`Peças (${pedido.itens.length})`} />
        <div className="overflow-hidden rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr><th className="w-16 px-3 py-3">Item</th><th className="px-3 py-3">Descrição</th><th className="w-24 px-3 py-3 text-center">Qtd.</th></tr>
            </thead>
            <tbody>
              {pedido.itens.map((item, index) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                  <td className="px-3 py-3 font-medium text-slate-900">{item.descricao}</td>
                  <td className="px-3 py-3 text-center font-semibold tabular-nums">{item.quantidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Envios aos fornecedores" />
        <div className="grid gap-3 lg:grid-cols-3">
          {pedido.envios.map((envio) => (
            <article key={envio.id} className="rounded-md border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{envio.fornecedor_nome}</p>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500" title={envio.fornecedor_email}>
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {envio.fornecedor_email}
                  </p>
                </div>
                <PedidoPecasStatusBadge status={envio.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div><dt className="text-slate-500">Tentativas</dt><dd className="mt-0.5 font-semibold">{envio.tentativas}</dd></div>
                <div><dt className="text-slate-500">Enviado em</dt><dd className="mt-0.5 font-semibold">{formatDateTime(envio.enviado_em)}</dd></div>
              </dl>
              {envio.erro_msg ? <p className="mt-3 break-words rounded-md bg-red-50 p-2 text-xs text-red-800">{envio.erro_msg}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value, icon }: { label: string; value: string | number | null; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-white px-3 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{icon}{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={String(value ?? "-")}>{value ?? "-"}</p>
    </div>
  );
}
