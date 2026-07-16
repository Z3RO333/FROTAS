import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PagePagination } from "@/components/ui/page-pagination";
import { FrotasFilters } from "@/components/frotas/frotas-filters";
import { FrotasTable } from "@/components/frotas/frotas-table";
import { listFrotas } from "@/lib/repos/frotas";
import { localizacoesDistintasCached, modelosDistintosCached } from "@/lib/repos/frotas-cache";
import { listCDsDisponibilidade } from "@/lib/repos/disponibilidade";
import type { StatusFrota } from "@/lib/rules";

export const dynamic = "force-dynamic";

const STATUS_VALUES = new Set(["disponivel", "manutencao", "atencao", "critico", "vendido"]);
const CONDICAO_VALUES = new Set(["normal", "atencao", "critico"]);

function pageHref(searchParams: Record<string, string | undefined>, page: number) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) next.set(key, value);
  }
  next.set("page", String(page));
  return `/frotas/vendidos?${next.toString()}`;
}

export default async function FrotasVendidasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const parsedPage = sp.page ? Number.parseInt(sp.page, 10) : 1;
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const status = sp.status && STATUS_VALUES.has(sp.status) ? (sp.status as StatusFrota) : undefined;
  const condicao =
    sp.condicao && CONDICAO_VALUES.has(sp.condicao)
      ? (sp.condicao as "normal" | "atencao" | "critico")
      : undefined;
  const idadeMin = sp.idadeMin ? Number.parseInt(sp.idadeMin, 10) : undefined;

  const filters = {
    search: sp.search,
    modelo: sp.modelo,
    localizacao: sp.localizacao,
    cd: sp.cd,
    status,
    condicao,
    cadastro: sp.cadastro === "incompleto" ? ("incompleto" as const) : undefined,
    semKm: sp.semKm === "1",
    idadeMin: idadeMin && Number.isFinite(idadeMin) ? idadeMin : undefined,
    vendidos: true,
    page,
    pageSize: 50,
  };

  const [{ rows, total }, modelos, localizacoes, cds] = await Promise.all([
    listFrotas(filters),
    modelosDistintosCached(),
    localizacoesDistintasCached(),
    listCDsDisponibilidade(),
  ]);
  const totalPages = Math.ceil(total / 50);
  if (totalPages > 0 && page > totalPages) redirect(pageHref(sp, totalPages));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Histórico</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Frotas vendidas</h1>
          <p className="text-sm text-muted-foreground">{total} frota(s) baixada(s) encontrada(s)</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/frotas">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Voltar para frotas
          </Link>
        </Button>
      </div>

      <FrotasFilters modelos={modelos} localizacoes={localizacoes} cds={cds} basePath="/frotas/vendidos" />
      <FrotasTable rows={rows} />

      <PagePagination page={page} totalPages={totalPages} href={(value) => pageHref(sp, value)} />
    </div>
  );
}
