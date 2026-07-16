import { requireOperacaoUser } from "@/lib/rbac";
import {
  getDisponibilidadePorCD,
  getDisponibilidadeGeral,
  getPontosAtencao,
} from "@/lib/repos/disponibilidade";
import {
  DisponibilidadeCDCard,
  DisponibilidadeGeralCard,
} from "@/components/dashboard/disponibilidade-cd-card";
import { AtencaoSection } from "@/components/dashboard/atencao-card";

export const dynamic = "force-dynamic";

export default async function DisponibilidadePage() {
  await requireOperacaoUser();

  const [cds, geral, pontos] = await Promise.all([
    getDisponibilidadePorCD(),
    getDisponibilidadeGeral(),
    getPontosAtencao(15),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Operação</p>
        <h1 className="text-3xl font-semibold tracking-tight">Disponibilidade por CD</h1>
        <p className="text-sm text-muted-foreground">{geral.total} frotas ativas monitoradas</p>
      </div>

      <DisponibilidadeGeralCard {...geral} />

      {cds.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Por centro de distribuição
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cds.map((cd) => (
              <DisponibilidadeCDCard key={cd.cd_nome} cd={cd} />
            ))}
          </div>
        </div>
      )}

      <AtencaoSection pontos={pontos} />
    </div>
  );
}
