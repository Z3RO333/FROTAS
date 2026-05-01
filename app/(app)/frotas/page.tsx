import Link from "next/link";
import { Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FrotasFilters } from "@/components/frotas/frotas-filters";
import { FrotasTable } from "@/components/frotas/frotas-table";
import { listFrotas, localizacoesDistintas, modelosDistintos } from "@/lib/repos/frotas";
import type { StatusFrota } from "@/lib/rules";

export const dynamic = "force-dynamic";

const STATUS_VALUES = new Set(["disponivel", "manutencao", "atencao", "critico"]);

function pageHref(searchParams: Record<string, string | undefined>, page: number) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) next.set(key, value);
  }
  next.set("page", String(page));
  return `/frotas?${next.toString()}`;
}

export default async function FrotasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = sp.page ? Number.parseInt(sp.page, 10) : 1;
  const status = sp.status && STATUS_VALUES.has(sp.status) ? (sp.status as StatusFrota) : undefined;
  const filters = {
    search: sp.search,
    modelo: sp.modelo,
    localizacao: sp.localizacao,
    status,
    page,
    pageSize: 50,
  };

  const [{ rows, total }, modelos, localizacoes] = await Promise.all([
    listFrotas(filters),
    modelosDistintos(),
    localizacoesDistintas(),
  ]);
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Frotas</h1>
          <p className="text-sm text-muted-foreground">{total} frota(s) ativa(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/frotas/relatorio">
              <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
              Enviar relatorio
            </Link>
          </Button>
          <Button asChild>
            <Link href="/frotas/novo">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Nova frota
            </Link>
          </Button>
        </div>
      </div>
      <FrotasFilters modelos={modelos} localizacoes={localizacoes} />
      <FrotasTable rows={rows} />
      {totalPages > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <Button key={p} variant={p === page ? "default" : "outline"} size="sm" asChild>
              <Link href={pageHref(sp, p)}>{p}</Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
