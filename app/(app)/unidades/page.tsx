import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DebouncedUrlSearch } from "@/components/ui/debounced-url-search";
import { PageHeader } from "@/components/ui/page-header";
import { countUnidades, listUnidades } from "@/lib/repos/unidades";
import { requireAdminUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function UnidadesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminUser();
  const sp = await searchParams;
  const search = sp.search?.trim() || "";
  const [unidades, total] = await Promise.all([listUnidades(search, 250), countUnidades()]);
  const negocios = new Set(unidades.map((item) => item.negocio).filter(Boolean));
  const ufs = new Set(unidades.map((item) => item.uf).filter(Boolean));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Base importada"
        title="Unidades operacionais"
        description="Dados da planilha de lojas, centros, CNPJ, inscrições e endereços."
        icon={Building2}
        severity="INFO"
        actions={
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Unidades" value={String(total)} />
            <SummaryCard label="Negócios" value={String(negocios.size)} />
            <SummaryCard label="UFs" value={String(ufs.size)} />
          </div>
        }
      />

      <Card>
        <CardContent className="p-4">
          <DebouncedUrlSearch
            paramName="search"
            defaultValue={search}
            placeholder="Pesquisar por loja, negócio, centro, CNPJ ou endereço"
            ariaLabel="Pesquisar unidade"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
            Resultado
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {unidades.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhuma unidade encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Loja / unidade</th>
                    <th className="px-4 py-3 font-medium">Negócio</th>
                    <th className="px-4 py-3 font-medium">UF</th>
                    <th className="px-4 py-3 font-medium">Centro</th>
                    <th className="px-4 py-3 font-medium">Centro de custo</th>
                    <th className="px-4 py-3 font-medium">CNPJ</th>
                    <th className="px-4 py-3 font-medium">Endereço</th>
                  </tr>
                </thead>
                <tbody>
                  {unidades.map((unidade) => (
                    <tr key={unidade.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium text-slate-950">{unidade.loja ?? "-"}</td>
                      <td className="px-4 py-3">
                        {unidade.negocio ? <Badge variant="outline">{unidade.negocio}</Badge> : "-"}
                      </td>
                      <td className="px-4 py-3">{unidade.uf ?? "-"}</td>
                      <td className="px-4 py-3">{unidade.centro ?? "-"}</td>
                      <td className="px-4 py-3">{unidade.centro_custo ?? "-"}</td>
                      <td className="px-4 py-3">{unidade.cnpj ?? "-"}</td>
                      <td className="max-w-[320px] px-4 py-3">{unidade.endereco ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-32">
      <CardContent className="p-4">
        <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
      </CardContent>
    </Card>
  );
}
