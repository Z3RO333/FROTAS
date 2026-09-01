import Link from "next/link";
import { redirect } from "next/navigation";
import { List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PagePagination } from "@/components/ui/page-pagination";
import { FrotasFilters } from "@/components/frotas/frotas-filters";
import { FrotasTable } from "@/components/frotas/frotas-table";
import { EnviarRelatorioDialog } from "@/components/relatorios/enviar-relatorio-dialog";
import { listFrotas } from "@/lib/repos/frotas";
import { setoresDistintosCached, modelosDistintosCached } from "@/lib/repos/frotas-cache";
import { listCDsDisponibilidade } from "@/lib/repos/disponibilidade";
import { requireAdminUser } from "@/lib/rbac";
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
  await requireAdminUser();
  const sp = await searchParams;
  const parsedPage = sp.page ? Number.parseInt(sp.page, 10) : 1;
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
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
    q: sp.q?.trim() || undefined,
    frota: sp.frota,
    placa: sp.placa,
    modelo: sp.modelo,
    setor: sp.setor,
    cd: sp.cd,
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

  const [{ rows, total }, modelos, setores, cds] = await Promise.all([
    listFrotas(filters),
    modelosDistintosCached(),
    setoresDistintosCached(),
    listCDsDisponibilidade(),
  ]);
  const totalPages = Math.ceil(total / 50);
  if (totalPages > 0 && page > totalPages) redirect(pageHref(sp, totalPages));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operação"
        title="Tabela de Frotas"
        description={`${total} frota(s) encontrada(s)${sp.cd ? ` em ${sp.cd}` : sp.setor ? ` · ${sp.setor}` : ""}.`}
        icon={List}
        severity="INFO"
        actions={
          <>
            <EnviarRelatorioDialog
              title="Enviar relatório geral"
              action={enviarRelatorioGeralAction}
              triggerVariant="outline"
            />
            <Button asChild>
              <Link href="/frotas/novo">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nova frota
              </Link>
            </Button>
          </>
        }
      />
      <FrotasFilters modelos={modelos} setores={setores} cds={cds} />
      <FrotasTable rows={rows} />
      <PagePagination page={page} totalPages={totalPages} href={(value) => pageHref(sp, value)} />
    </div>
  );
}
