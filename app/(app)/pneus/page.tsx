import { Search, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { listVeiculos } from "@/lib/repos/manutencao/pneus";
import { redirect } from "next/navigation";
import type { Veiculo } from "@/lib/repos/manutencao/types";

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

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Manutenção</p>
        <h1 className="text-3xl font-semibold tracking-tight">Gestão de Pneus</h1>
      </div>

      <form className="grid gap-2 rounded-md border bg-white p-3 shadow-sm sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Frota, placa ou modelo" className="pl-9" />
        </div>
        <Button type="submit">Buscar</Button>
      </form>

      <p className="text-sm text-muted-foreground">{veiculos.length} veículo{veiculos.length !== 1 ? "s" : ""}</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {veiculos.map((v) => (
          <VeiculoCard key={v.id} veiculo={v} />
        ))}
        {veiculos.length === 0 && (
          <p className="col-span-full py-8 text-center text-muted-foreground">
            Nenhum veículo encontrado.
          </p>
        )}
      </div>
    </div>
  );
}

function VeiculoCard({ veiculo }: { veiculo: Veiculo }) {
  return (
    <article className="space-y-3 rounded-md border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Frota {veiculo.codigo_frota}</h2>
          <p className="text-sm text-muted-foreground">
            {veiculo.placa ?? "Sem placa"} — {veiculo.modelo ?? "Sem modelo"}
          </p>
        </div>
        <Badge variant="outline">{veiculo.qtd_pneus} pneus</Badge>
      </div>
      {veiculo.local && <p className="text-xs text-muted-foreground">{veiculo.local}</p>}
    </article>
  );
}
