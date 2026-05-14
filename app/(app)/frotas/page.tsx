import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FrotasFilters } from "@/components/frotas/frotas-filters";
import { FrotasTable } from "@/components/frotas/frotas-table";
import { EnviarRelatorioDialog } from "@/components/relatorios/enviar-relatorio-dialog";
import { listFrotas } from "@/lib/repos/frotas";
import { localizacoesDistintasCached, modelosDistintosCached } from "@/lib/repos/frotas-cache";
import type { StatusFrota } from "@/lib/rules";
import { enviarRelatorioGeralAction } from "./_actions";

export const dynamic = "force-dynamic";

const STATUS_VALUES = new Set(["disponivel", "manutencao", "atencao", "critico"]);
const OPERACIONAL_VALUES = new Set(["disponivel", "manutencao", "indisponivel", "baixado"]);
const CONDICAO_VALUES = new Set(["normal", "atencao", "critico"]);

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
  const operacional =
    sp.operacional && OPERACIONAL_VALUES.has(sp.operacional)
      ? (sp.operacional as "disponivel" | "manutencao" | "indisponivel" | "baixado")
      : undefined;
  const condicao =
    sp.condicao && CONDICAO_VALUES.has(sp.condicao)
      ? (sp.condicao as "normal" | "atencao" | "critico")
      : undefined;
  const idadeMin = sp.idadeMin ? Number.parseInt(sp.idadeMin, 10) : undefined;
  const ano = sp.ano ? Number.parseInt(sp.ano, 10) : undefined;
  const filters = {
    search: sp.search,
    modelo: sp.modelo,
    localizacao: sp.localizacao,
    ano: ano && Number.isFinite(ano) ? ano : undefined,
    status,
    operacional,
    condicao,
    cadastro: sp.cadastro === "incompleto" ? ("incompleto" as const) : undefined,
    semKm: sp.semKm === "1",
    idadeMin: idadeMin && Number.isFinite(idadeMin) ? idadeMin : undefined,
    page,
    pageSize: 50,
  };

  const [{ rows, total }, modelos, localizacoes] = await Promise.all([
    listFrotas(filters),
    modelosDistintosCached(),
    localizacoesDistintasCached(),
  ]);
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Operacao</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Tabela de frotas</h1>
          <p className="text-sm text-muted-foreground">{total} frota(s) encontrada(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EnviarRelatorioDialog
            title="Enviar relatorio geral"
            action={enviarRelatorioGeralAction}
            triggerVariant="outline"
          />
          <Button asChild>
            <Link href="/frotas/novo">
              <Plus className="h-4 w-4" aria-hidden="true" />
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
