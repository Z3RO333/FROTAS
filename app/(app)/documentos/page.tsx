import { redirect } from "next/navigation";
import type { ElementType } from "react";
import { ExternalLink, FileCheck2, FileText, Gauge, Search, ShieldCheck, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canAccessDocumentos, requireAppUser } from "@/lib/rbac";
import { listDocuments } from "@/lib/repos/manutencao/documents";
import type { DocumentRecord } from "@/lib/repos/manutencao/types";

export const dynamic = "force-dynamic";

const TACOGRAFO_URL = "https://cronotacografo.rbmlq.gov.br/certificados/consultar";

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAppUser();
  if (!canAccessDocumentos(user.perfil)) redirect("/");

  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;
  const { rows, total } = await listDocuments({
    frota: sp.frota,
    placa: sp.placa,
    page,
  });

  const docsCompletos = rows.filter((doc) => doc.dut_url && doc.crlv_url).length;
  const arquivosNaPagina = rows.reduce((totalArquivos, doc) => totalArquivos + (doc.dut_url ? 1 : 0) + (doc.crlv_url ? 1 : 0), 0);
  const conformidadePagina = rows.length > 0 ? Math.round((docsCompletos / rows.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-md border bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[380px_1fr]">
          <div className="bg-slate-950 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-200">Documentos</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Consulta da frota</h1>
            <p className="mt-3 text-sm text-slate-300">
              Localize DUT e CRLV com leitura operacional rápida, mantendo o módulo de documentos dentro da plataforma única.
            </p>
            <Button asChild variant="secondary" className="mt-5">
              <a href={TACOGRAFO_URL} target="_blank" rel="noopener noreferrer">
                <Gauge className="h-4 w-4" aria-hidden="true" />
                Consultar tacógrafo
              </a>
            </Button>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <Metric icon={Truck} label="Registros" value={String(total)} />
            <Metric icon={FileCheck2} label="Arquivos na página" value={String(arquivosNaPagina)} />
            <Metric icon={ShieldCheck} label="Conformidade da página" value={`${conformidadePagina}%`} />
          </div>
        </div>
      </section>

      <form className="grid gap-2 rounded-md border bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto]">
        <Input name="frota" defaultValue={sp.frota ?? ""} placeholder="Número da frota" />
        <Input name="placa" defaultValue={sp.placa ?? ""} placeholder="Placa" />
        <Button type="submit">
          <Search className="h-4 w-4" aria-hidden="true" />
          Buscar
        </Button>
      </form>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-md border bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-4 py-3">
            <h2 className="font-semibold text-slate-950">Resultado da consulta</h2>
            <p className="text-sm text-muted-foreground">
              {total} documento{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Frota</th>
                  <th className="px-4 py-3 font-medium">Placa</th>
                  <th className="px-4 py-3 font-medium">Modelo</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">DUT</th>
                  <th className="px-4 py-3 font-medium">CRLV</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((doc) => (
                  <tr key={doc.id} className="border-t">
                    <td className="px-4 py-3 font-semibold text-slate-950">{doc.frota}</td>
                    <td className="px-4 py-3 uppercase">{doc.placa}</td>
                    <td className="px-4 py-3">{doc.modelo}</td>
                    <td className="px-4 py-3">
                      <DocumentStatus doc={doc} />
                    </td>
                    <td className="px-4 py-3">
                      <DocumentLink href={doc.dut_url} label="DUT" />
                    </td>
                    <td className="px-4 py-3">
                      <DocumentLink href={doc.crlv_url} label="CRLV" />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      Nenhum documento encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-3">
          {rows.slice(0, 5).map((doc) => (
            <DocumentMiniCard key={doc.id} doc={doc} />
          ))}
          {rows.length === 0 ? (
            <div className="rounded-md border bg-white p-5 text-sm text-muted-foreground">
              Use a busca por frota ou placa para localizar documentos.
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-blue-700" aria-hidden="true" />
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function DocumentStatus({ doc }: { doc: DocumentRecord }) {
  const hasDut = Boolean(doc.dut_url);
  const hasCrlv = Boolean(doc.crlv_url);
  if (hasDut && hasCrlv) {
    return <Badge className="border-transparent bg-emerald-600 text-white hover:bg-emerald-600">Completo</Badge>;
  }
  if (hasDut || hasCrlv) {
    return <Badge className="border-transparent bg-amber-500 text-white hover:bg-amber-500">Parcial</Badge>;
  }
  return <Badge variant="outline">Pendente</Badge>;
}

function DocumentLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return <span className="text-muted-foreground">--</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <Badge variant="outline" className="cursor-pointer gap-1 bg-white hover:bg-slate-50">
        <FileText className="h-3 w-3" aria-hidden="true" />
        {label}
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </Badge>
    </a>
  );
}

function DocumentMiniCard({ doc }: { doc: DocumentRecord }) {
  return (
    <article className="rounded-md border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">Frota {doc.frota}</h3>
          <p className="text-sm text-muted-foreground">
            {doc.placa} · {doc.modelo}
          </p>
        </div>
        <DocumentStatus doc={doc} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <DocumentLink href={doc.dut_url} label="DUT" />
        <DocumentLink href={doc.crlv_url} label="CRLV" />
      </div>
    </article>
  );
}
