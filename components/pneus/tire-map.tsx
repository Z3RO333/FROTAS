import { cn } from "@/lib/utils";
import type { PneuRow } from "@/lib/repos/planejamento";

type Props = {
  pneus: PneuRow[];
  className?: string;
};

function normPos(p: string): string {
  return p.trim().toUpperCase().replace(/\s+/g, "_").replace(/º/g, "");
}

function Tire({ pneu, label }: { pneu: PneuRow | undefined; label: string }) {
  const has = !!pneu;
  const marcado = pneu?.marcado;

  const tone = !has
    ? "bg-slate-50 border-slate-200 text-slate-300"
    : marcado
      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
      : "bg-amber-50 border-amber-300 text-amber-900";

  return (
    <div
      className={cn(
        "relative flex h-14 w-11 flex-col items-center justify-center rounded border-2 text-center transition-colors",
        tone
      )}
      title={pneu ? `${pneu.posicao} · ${pneu.marca ?? "—"} · Fogo ${pneu.numero_fogo ?? "—"}` : label}
    >
      <span className="text-[9px] font-bold leading-none">{label}</span>
      {pneu?.numero_fogo && (
        <span className="mt-0.5 truncate w-full px-0.5 text-[8px] tabular-nums opacity-70">
          {pneu.numero_fogo}
        </span>
      )}
    </div>
  );
}

type EixoSlots = {
  left_outer?: PneuRow;
  left_inner?: PneuRow;
  right_inner?: PneuRow;
  right_outer?: PneuRow;
};

function detectAxles(pneus: PneuRow[]): {
  front?: { left?: PneuRow; right?: PneuRow };
  rearAxles: EixoSlots[];
  steps: PneuRow[];
} {
  let frontLeft: PneuRow | undefined;
  let frontRight: PneuRow | undefined;
  const axles: Record<number, EixoSlots> = {};
  const steps: PneuRow[] = [];

  for (const p of pneus) {
    const n = normPos(p.posicao);
    if (n === "DD") frontRight = p;
    else if (n === "DE") frontLeft = p;
    else if (n === "TD") {
      axles[1] = { ...(axles[1] ?? {}), right_outer: p };
    } else if (n === "TE") {
      axles[1] = { ...(axles[1] ?? {}), left_outer: p };
    } else if (n.startsWith("STEP") || n.startsWith("ESTEPE")) {
      steps.push(p);
    } else {
      // Aceita: TDE, TDE_1_EIXO, TDE_1_EIX, TDE_1_IEX (typo), TDE_2_EIX, TDE_3_EIX...
      const match = n.match(/^(TDE|TDI|TEE|TEI)(?:_(\d+).*)?$/);
      if (!match) continue;
      const tipo = match[1];
      const eixo = match[2] ? Number(match[2]) : 1;
      const slot = (axles[eixo] = axles[eixo] ?? {});
      if (tipo === "TDE") slot.right_outer = p;
      else if (tipo === "TDI") slot.right_inner = p;
      else if (tipo === "TEE") slot.left_outer = p;
      else if (tipo === "TEI") slot.left_inner = p;
    }
  }

  const rearAxles = Object.keys(axles)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((k) => axles[k]);

  return {
    front: frontLeft || frontRight ? { left: frontLeft, right: frontRight } : undefined,
    rearAxles,
    steps,
  };
}

function AxleRow({ slot }: { slot: EixoSlots }) {
  const hasDoubles = slot.left_inner || slot.right_inner;
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-0.5">
        {slot.left_outer && <Tire pneu={slot.left_outer} label="TEE" />}
        {hasDoubles && <Tire pneu={slot.left_inner} label="TEI" />}
      </div>
      <div className="h-1 w-6 rounded-full bg-slate-200" />
      <div className="flex gap-0.5">
        {hasDoubles && <Tire pneu={slot.right_inner} label="TDI" />}
        {slot.right_outer && <Tire pneu={slot.right_outer} label="TDE" />}
      </div>
    </div>
  );
}

export function TireMap({ pneus, className }: Props) {
  const { front, rearAxles, steps } = detectAxles(pneus);
  const hasFront = !!front;

  return (
    <div className={cn("rounded-lg border bg-white p-6", className)}>
      <div className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {hasFront ? "Frente" : "Carreta / Reboque"}
      </div>

      <div className="flex flex-col items-center gap-3">
        {front && (
          <div className="flex items-center gap-6">
            <Tire pneu={front.left} label="DE" />
            <div className="h-1 w-10 rounded-full bg-slate-200" />
            <Tire pneu={front.right} label="DD" />
          </div>
        )}

        {rearAxles.map((axle, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-6 w-1.5 rounded-full bg-slate-200" />
            <AxleRow slot={axle} />
            {rearAxles.length > 1 && (
              <span className="text-[9px] uppercase text-muted-foreground">{i + 1}º eixo</span>
            )}
          </div>
        ))}
      </div>

      {steps.length > 0 && (
        <div className="mt-5 flex flex-col items-center border-t pt-3">
          <span className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {steps.length > 1 ? `${steps.length} estepes` : "Estepe"}
          </span>
          <div className="flex gap-2">
            {steps.map((s, i) => (
              <Tire key={i} pneu={s} label={s.posicao.length <= 5 ? s.posicao : "STEP"} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Marcado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-amber-500" /> Sem marca
        </span>
      </div>
    </div>
  );
}

export function TireDetailGrid({ pneus }: { pneus: PneuRow[] }) {
  if (pneus.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {pneus.map((p, i) => (
        <div key={`${p.posicao}-${i}`} className="rounded-lg border bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">{p.posicao}</span>
            {p.marcado ? (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                Marcado
              </span>
            ) : (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                Sem marca
              </span>
            )}
          </div>
          <div className="mt-2 space-y-0.5 text-xs">
            <div>
              <span className="text-muted-foreground">Nº Fogo: </span>
              <span className="font-mono tabular-nums">{p.numero_fogo ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Marca: </span>
              <span>{p.marca ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Montagem: </span>
              <span>{p.dt_montagem ?? "—"}</span>
            </div>
            {p.numero_fogo_anterior && (
              <div className="border-t pt-1 mt-1">
                <span className="text-muted-foreground">Anterior: </span>
                <span className="font-mono">{p.numero_fogo_anterior}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
