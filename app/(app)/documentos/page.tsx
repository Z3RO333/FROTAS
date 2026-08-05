import { redirect } from "next/navigation";
import { DocumentosWorkspace } from "@/components/documentos/documentos-workspace";
import { canAccessDocumentos, canWriteDocumentos, requireAppUser } from "@/lib/rbac";
import { listAllDocuments } from "@/lib/repos/manutencao/documents";

export const dynamic = "force-dynamic";

export default async function DocumentosPage() {
  const user = await requireAppUser();
  if (!canAccessDocumentos(user.perfil)) redirect("/");

  const rows = await listAllDocuments();

  return (
    <DocumentosWorkspace
      documents={rows}
      total={rows.length}
      canWrite={canWriteDocumentos(user.perfil)}
    />
  );
}
