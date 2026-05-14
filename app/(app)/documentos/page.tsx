import { redirect } from "next/navigation";
import { DocumentosWorkspace } from "@/components/documentos/documentos-workspace";
import { canAccessDocumentos, canWriteDocumentos, requireAppUser } from "@/lib/rbac";
import { listDocuments } from "@/lib/repos/manutencao/documents";

export const dynamic = "force-dynamic";

export default async function DocumentosPage() {
  const user = await requireAppUser();
  if (!canAccessDocumentos(user.perfil)) redirect("/");

  const { rows, total } = await listDocuments({ pageSize: 100 });

  return (
    <DocumentosWorkspace
      documents={rows}
      total={total}
      canWrite={canWriteDocumentos(user.perfil)}
    />
  );
}
