import { FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAppUser, canAccessDocumentos } from "@/lib/rbac";
import { listDocuments } from "@/lib/repos/manutencao/documents";
import { redirect } from "next/navigation";
import type { DocumentRecord } from "@/lib/repos/manutencao/types";

export const dynamic = "force-dynamic";

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAppUser();
  if (!canAccessDocumentos(user.perfil)) redirect("/");

  const sp = await searchParams;
  const { rows, total } = await listDocuments({
    frota: sp.frota,
    placa: sp.placa,
    page: sp.page ? Number(sp.page) : 1,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Documentos</p>
          <h1 className="text-3xl font-semibold tracking-tight">Documentos da frota</h1>
        </div>
      </div>

      <form className="grid gap-2 rounded-md border bg-white p-3 shadow-sm sm:grid-cols-[1fr_1fr_auto]">
        <Input name="frota" defaultValue={sp.frota ?? ""} placeholder="Número da frota" />
        <Input name="placa" defaultValue={sp.placa ?? ""} placeholder="Placa" />
        <Button type="submit">
          <Search className="h-4 w-4" />
          Buscar
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {total} documento{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
      </p>

      <section className="overflow-hidden rounded-md border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Frota</th>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">DUT</th>
                <th className="px-4 py-3">CRLV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((doc: DocumentRecord) => (
                <tr key={doc.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{doc.frota}</td>
                  <td className="px-4 py-3">{doc.placa}</td>
                  <td className="px-4 py-3">{doc.modelo}</td>
                  <td className="px-4 py-3">
                    <a href={doc.dut_url} target="_blank" rel="noopener noreferrer">
                      <Badge variant="outline" className="cursor-pointer gap-1 hover:bg-slate-50">
                        <FileText className="h-3 w-3" /> DUT
                      </Badge>
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <a href={doc.crlv_url} target="_blank" rel="noopener noreferrer">
                      <Badge variant="outline" className="cursor-pointer gap-1 hover:bg-slate-50">
                        <FileText className="h-3 w-3" /> CRLV
                      </Badge>
                    </a>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum documento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
