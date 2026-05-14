import { redirect } from "next/navigation";
import { PneusWorkspace } from "@/components/pneus/pneus-workspace";
import { canAccessManutencao, requireAppUser } from "@/lib/rbac";
import { listUltimaContagemNumeroFogoPorFrota, listVeiculos } from "@/lib/repos/manutencao/pneus";

export const dynamic = "force-dynamic";

export default async function PneusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");

  const sp = await searchParams;
  const [veiculos, ultimaContagemPorFrota] = await Promise.all([
    listVeiculos(sp.q),
    listUltimaContagemNumeroFogoPorFrota(),
  ]);

  return <PneusWorkspace veiculos={veiculos} query={sp.q} ultimaContagemPorFrota={ultimaContagemPorFrota} />;
}
