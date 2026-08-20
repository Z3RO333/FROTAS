import { redirect } from "next/navigation";
import { DocumentosWorkspace } from "@/components/documentos/documentos-workspace";
import { canAccessDocumentos, canWriteDocumentos, requireAppUser } from "@/lib/rbac";
import { listAllDocumentsForFrotasAtivas } from "@/lib/repos/manutencao/documents";
import { listFrotasForReport } from "@/lib/repos/frotas";

export const dynamic = "force-dynamic";

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ frota?: string; placa?: string; status?: string }>;
}) {
  const user = await requireAppUser();
  if (!canAccessDocumentos(user.perfil)) redirect("/");

  const sp = await searchParams;
  const frotasAtivas = await listFrotasForReport();
  const rows = await listAllDocumentsForFrotasAtivas(frotasAtivas);

  return (
    <DocumentosWorkspace
      documents={rows}
      total={rows.length}
      canWrite={canWriteDocumentos(user.perfil)}
      initialFrota={sp.frota}
      initialPlaca={sp.placa}
      initialStatus={sp.status}
    />
  );
}
