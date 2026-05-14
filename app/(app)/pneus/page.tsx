import { redirect } from "next/navigation";
import { PneusWorkspace } from "@/components/pneus/pneus-workspace";
import { canAccessManutencao, requireAppUser } from "@/lib/rbac";
import { listVeiculos } from "@/lib/repos/manutencao/pneus";

export const dynamic = "force-dynamic";

export default async function PneusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");

  const sp = await searchParams;
  const veiculos = await listVeiculos(sp.q);

  return <PneusWorkspace veiculos={veiculos} query={sp.q} />;
}
