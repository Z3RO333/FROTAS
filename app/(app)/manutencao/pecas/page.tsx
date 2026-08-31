import { randomUUID } from "node:crypto";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, PackageSearch } from "lucide-react";
import { PedidoPecasForm } from "@/components/manutencao/pedido-pecas-form";
import { PedidoPecasStatusBadge } from "@/components/manutencao/pedido-pecas-status";
import { PedidosPecasTabs } from "@/components/manutencao/pedidos-pecas-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getPreferenciaFornecedoresPecas, listFornecedoresPecas } from "@/lib/repos/fornecedores-pecas";
import { listFrotasForOperationalForms } from "@/lib/repos/frotas";
import { listPedidosPecas } from "@/lib/repos/pedidos-pecas";
import { requireManutencaoUser } from "@/lib/rbac";
import { criarPedidoPecasAction } from "./_actions";

export const dynamic = "force-dynamic";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus",
  }).format(new Date(value));
}

function resultCount(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10 ? parsed : 0;
}

export default async function PedidosPecasPage({
  searchParams,
}: {
  searchParams: Promise<{
    resultado?: string;
    total?: string;
    enviados?: string;
    parciais?: string;
    erros?: string;
  }>;
}) {
  const user = await requireManutencaoUser();
  const [frotas, fornecedores, pedidos, preferenciaFornecedorIds, query] = await Promise.all([
    listFrotasForOperationalForms(),
    listFornecedoresPecas({ ativo: true }),
    listPedidosPecas(100),
    getPreferenciaFornecedoresPecas(user.email),
    searchParams,
  ]);
  const lote = query.resultado === "lote" ? {
    total: resultCount(query.total),
    enviados: resultCount(query.enviados),
    parciais: resultCount(query.parciais),
    erros: resultCount(query.erros),
  } : null;
  const vehicles = frotas.map((frota) => ({
    id: frota.id,
    codigo: frota.frota_geral,
    placa: frota.placa,
    modelo: frota.modelo,
    localizacao: frota.localizacao,
    ativo: frota.ativo,
    vendido: frota.vendido,
    chassi: frota.chassi,
    ano: frota.ano_fabricacao,
  }));

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Manutenção"
        title="Pedidos de peças"
        description={`${pedidos.length} pedido(s) recente(s).`}
        icon={PackageSearch}
        severity="INFO"
      />

      <PedidosPecasTabs />

      {lote ? (
        <div className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${
          lote.erros === 0 && lote.parciais === 0
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}>
          {lote.erros === 0 && lote.parciais === 0
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          <p>
            <strong>Lote com {lote.total} frotas registrado.</strong>{" "}
            {lote.enviados} enviado(s), {lote.parciais} parcial(is) e {lote.erros} com falha.
          </p>
        </div>
      ) : null}

      <section className="rounded-md border bg-white p-4 shadow-sm sm:p-5">
        <SectionHeader title="Novo lote de solicitações" />
        <div className="mt-5">
          <PedidoPecasForm
            vehicles={vehicles}
            fornecedores={fornecedores}
            preferenciaFornecedorIds={preferenciaFornecedorIds}
            initialToken={randomUUID()}
            action={criarPedidoPecasAction}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Histórico de pedidos" description="Últimas 100 solicitações registradas." />
        {pedidos.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="Nenhum pedido registrado"
            description="O primeiro pedido aparecerá aqui após o envio."
          />
        ) : (
          <div className="overflow-x-auto rounded-md border bg-white shadow-sm">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Pedido</th>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Frota</th>
                  <th className="px-3 py-3">Peças</th>
                  <th className="px-3 py-3">Solicitante</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="w-12 px-3 py-3"><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((pedido) => (
                  <tr key={pedido.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">{pedido.codigo}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDateTime(pedido.criado_em)}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">Frota {pedido.frota_codigo}</p>
                      <p className="text-xs text-slate-500">{pedido.placa ?? "Sem placa"}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{pedido.itens.length}</td>
                    <td className="max-w-48 truncate px-3 py-3 text-slate-600" title={pedido.solicitante_email}>
                      {pedido.solicitante_nome}
                    </td>
                    <td className="px-3 py-3"><PedidoPecasStatusBadge status={pedido.status} /></td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/manutencao/pecas/${pedido.id}`}
                        aria-label={`Abrir pedido ${pedido.codigo}`}
                        title="Abrir pedido"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-700"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
