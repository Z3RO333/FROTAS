import { cn } from "@/lib/utils";
import type { DisponibilidadeCD, DisponibilidadeGeral } from "@/lib/repos/disponibilidade";
import { ProgressBar } from "@/components/ui/progress-bar";

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className={cn("text-lg font-bold tabular-nums", color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function DisponibilidadeCDCard({ cd }: { cd: DisponibilidadeCD }) {
  const pct = cd.percentual_disponibilidade;
  const cor = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-600";
  const barTone = pct >= 80 ? "emerald" : pct >= 60 ? "amber" : "red";

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {cd.cd_nome}
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">{cd.total}</p>
          <p className="text-xs text-muted-foreground">frotas ativas</p>
        </div>
        <div className="text-right">
          <p className={cn("text-2xl font-bold tabular-nums", cor)}>{pct}%</p>
          <p className="text-xs text-muted-foreground">disponível</p>
        </div>
      </div>

      <ProgressBar
        className="mt-3"
        value={pct}
        tone={barTone}
        label={`Disponibilidade de ${cd.cd_nome}: ${pct}%`}
      />

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Disponíveis" value={cd.disponiveis} color="text-emerald-600" />
        <Stat label="Manutenção" value={cd.em_manutencao} color="text-violet-600" />
        <Stat label="Paradas" value={cd.paradas} color="text-red-600" />
      </div>
    </div>
  );
}

export function DisponibilidadeGeralCard({
  total,
  disponiveis,
  em_manutencao,
  paradas,
  percentual_disponibilidade,
}: DisponibilidadeGeral) {
  const pct = percentual_disponibilidade;
  const cor = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-600";

  return (
    <div className="rounded-xl border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
        Consolidado — Todas as operações
      </p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <div>
          <p className="text-4xl font-bold tabular-nums tracking-tight">{total}</p>
          <p className="text-sm text-muted-foreground">frotas ativas</p>
        </div>
        <p className={cn("text-4xl font-bold tabular-nums", cor)}>{pct}%</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <Stat label="Disponíveis" value={disponiveis} color="text-emerald-600" />
        <Stat label="Manutenção" value={em_manutencao} color="text-violet-600" />
        <Stat label="Paradas" value={paradas} color="text-red-600" />
      </div>
    </div>
  );
}
