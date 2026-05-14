import { Building2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Base importada</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Unidades operacionais</h1>
          <p className="text-sm text-muted-foreground">
            Dados da planilha de lojas, centros, CNPJ, inscrições e endereços.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Unidades" value={String(total)} />
          <SummaryCard label="Negócios" value={String(negocios.size)} />
          <SummaryCard label="UFs" value={String(ufs.size)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <form className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Pesquisar unidade</span>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="search"
                defaultValue={search}
                placeholder="Pesquisar por loja, negócio, centro, CNPJ ou endereço"
                className="h-10 w-full rounded-md border bg-white pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" aria-hidden="true" />
              Pesquisar
            </Button>
          </form>
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
