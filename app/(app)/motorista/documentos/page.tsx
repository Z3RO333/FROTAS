import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentPreviewDialog } from "@/components/documentos/document-preview-dialog";
import { listAllDocuments } from "@/lib/repos/manutencao/documents";

export const dynamic = "force-dynamic";

export default async function MotoristaDocumentosPage() {
  const documentos = await listAllDocuments();
  const comArquivos = documentos.filter((d) => d.dut_url || d.crlv_url);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        eyebrow="Consulta"
        title="Documentos do Veículo"
        description="Visualize e baixe DUT e CRLV das frotas. Nenhuma alteração pode ser feita aqui."
        icon={FileText}
      />

      {comArquivos.length === 0 ? (
        <p className="rounded-md border bg-white p-6 text-center text-sm text-muted-foreground">
          Nenhum documento disponível no momento.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Frota</th>
                <th className="px-4 py-3">Placa</th>
                <th className="hidden px-4 py-3 sm:table-cell">Modelo</th>
                <th className="px-4 py-3">DUT</th>
                <th className="px-4 py-3">CRLV</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {comArquivos.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium tabular-nums">{doc.frota}</td>
                  <td className="px-4 py-3 tabular-nums">{doc.placa}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{doc.modelo}</td>
                  <td className="px-4 py-3">
                    {doc.dut_signed_url && doc.dut_download_url ? (
                      <DocumentPreviewDialog
                        signedUrl={doc.dut_signed_url}
                        downloadUrl={doc.dut_download_url}
                        label="DUT"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {doc.crlv_signed_url && doc.crlv_download_url ? (
                      <DocumentPreviewDialog
                        signedUrl={doc.crlv_signed_url}
                        downloadUrl={doc.crlv_download_url}
                        label="CRLV"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
