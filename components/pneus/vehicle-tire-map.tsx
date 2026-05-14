"use client";

import type { TipoLayoutPneus } from "@/lib/pneus-layout";
import { DESCRICAO_POSICAO_PNEU, NOME_LAYOUT_PNEUS } from "@/lib/pneus-layout";

type Wheel = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  spare?: boolean;
};

type LayoutConfig = {
  name: string;
  total: number;
  width: number;
  height: number;
  body: { x: number; y: number; width: number; height: number };
  wheels: Wheel[];
};

const CANVAS_WIDTH = 260;
const CENTER_X = CANVAS_WIDTH / 2;
const TIRE_WIDTH = 26;
const TIRE_HEIGHT = 44;
const BODY_WIDTH = 92;

function wheel({
  id,
  label,
  y,
  side = "left",
  offset = 68,
  width = TIRE_WIDTH,
  height = TIRE_HEIGHT,
  spare = false,
}: {
  id: string;
  label: string;
  y: number;
  side?: "left" | "right" | "center";
  offset?: number;
  width?: number;
  height?: number;
  spare?: boolean;
}): Wheel {
  const x = side === "center" ? CENTER_X - width / 2 : side === "left" ? CENTER_X - offset - width : CENTER_X + offset;
  return { id, label, x, y, width, height, spare };
}

function dualAxle(y: number, labels: [string, string, string, string], prefix = "t1"): Wheel[] {
  return [
    wheel({ id: labels[0], label: labels[0].toUpperCase(), y, side: "left", offset: 58 }),
    wheel({ id: labels[1], label: labels[1].toUpperCase(), y, side: "left", offset: 94 }),
    wheel({ id: labels[2], label: labels[2].toUpperCase(), y, side: "right", offset: 58 }),
    wheel({ id: labels[3], label: labels[3].toUpperCase(), y, side: "right", offset: 94 }),
  ].map((item) => ({ ...item, label: item.label.replace(prefix.toUpperCase(), prefix.toUpperCase()) }));
}

function config(name: string, total: number, bodyY: number, bodyHeight: number, wheels: Wheel[], height?: number): LayoutConfig {
  const maxWheelBottom = wheels.reduce((max, item) => Math.max(max, item.y + item.height + 28), 0);
  return {
    name,
    total,
    width: CANVAS_WIDTH,
    height: Math.max(height ?? 0, bodyY + bodyHeight + 72, maxWheelBottom),
    body: { x: CENTER_X - BODY_WIDTH / 2, y: bodyY, width: BODY_WIDTH, height: bodyHeight },
    wheels,
  };
}

const LAYOUTS: Record<TipoLayoutPneus, LayoutConfig> = {
  utilitario_5: config(NOME_LAYOUT_PNEUS.utilitario_5, 5, 60, 170, [
    wheel({ id: "de", label: "DE", y: 90, side: "left" }),
    wheel({ id: "dd", label: "DD", y: 90, side: "right" }),
    wheel({ id: "te", label: "TE", y: 230, side: "left" }),
    wheel({ id: "td", label: "TD", y: 230, side: "right" }),
    wheel({ id: "estepe", label: "Estepe", y: 160, side: "center", width: 34, height: 34, spare: true }),
  ]),
  sprinter_6: config(NOME_LAYOUT_PNEUS.sprinter_6, 6, 60, 210, [
    wheel({ id: "de", label: "DE", y: 80, side: "left" }),
    wheel({ id: "dd", label: "DD", y: 80, side: "right" }),
    ...dualAxle(230, ["t1ei", "t1ee", "t1di", "t1de"]),
  ]),
  simples_7: config(NOME_LAYOUT_PNEUS.simples_7, 7, 60, 210, [
    wheel({ id: "de", label: "DE", y: 80, side: "left" }),
    wheel({ id: "dd", label: "DD", y: 80, side: "right" }),
    ...dualAxle(230, ["t1ei", "t1ee", "t1di", "t1de"]),
    wheel({ id: "estepe", label: "Estepe", y: 150, side: "center", width: 34, height: 34, spare: true }),
  ]),
  carreta_9: config(NOME_LAYOUT_PNEUS.carreta_9, 9, 55, 210, [
    ...dualAxle(95, ["d1ei", "d1ee", "d1di", "d1de"], "d1"),
    ...dualAxle(240, ["d2ei", "d2ee", "d2di", "d2de"], "d2"),
    wheel({ id: "estepe", label: "Estepe", y: 165, side: "center", width: 34, height: 34, spare: true }),
  ]),
  carreta_10: config(NOME_LAYOUT_PNEUS.carreta_10, 10, 40, 260, [
    wheel({ id: "de", label: "DE", y: 70, side: "left" }),
    wheel({ id: "dd", label: "DD", y: 70, side: "right" }),
    ...dualAxle(210, ["t1ei", "t1ee", "t1di", "t1de"]),
    ...dualAxle(320, ["t2ei", "t2ee", "t2di", "t2de"], "t2"),
  ], 380),
  truck_11: config(NOME_LAYOUT_PNEUS.truck_11, 11, 40, 260, [
    wheel({ id: "de", label: "DE", y: 70, side: "left" }),
    wheel({ id: "dd", label: "DD", y: 70, side: "right" }),
    ...dualAxle(210, ["t1ei", "t1ee", "t1di", "t1de"]),
    ...dualAxle(320, ["t2ei", "t2ee", "t2di", "t2de"], "t2"),
    wheel({ id: "estepe", label: "Estepe", y: 190, side: "center", width: 34, height: 34, spare: true }),
  ], 390),
  bitruck_13: config(NOME_LAYOUT_PNEUS.bitruck_13, 13, 40, 320, [
    wheel({ id: "de", label: "DE", y: 60, side: "left" }),
    wheel({ id: "dd", label: "DD", y: 60, side: "right" }),
    ...dualAxle(200, ["t1ei", "t1ee", "t1di", "t1de"]),
    ...dualAxle(310, ["t2ei", "t2ee", "t2di", "t2de"], "t2"),
    ...dualAxle(400, ["t3ei", "t3ee", "t3di", "t3de"], "t3"),
    wheel({ id: "estepe", label: "Estepe", y: 250, side: "center", width: 34, height: 34, spare: true }),
  ], 470),
};

export function VehicleTireMap({
  tipo,
  selected,
  onToggle,
}: {
  tipo: TipoLayoutPneus;
  selected: string[];
  onToggle: (position: string) => void;
}) {
  const layout = LAYOUTS[tipo];

  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-sm font-semibold text-slate-800">{layout.name}</h3>
        <p className="text-xs text-muted-foreground">Total: {layout.total} pneus</p>
      </div>
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="mx-auto rounded-md border border-blue-100 bg-white shadow-inner"
        role="img"
        aria-label={`Mapa de pneus: ${layout.name}`}
      >
        <defs>
          <pattern id={`grid-${tipo}`} width="14" height="14" patternUnits="userSpaceOnUse">
            <path d="M14 0H0V14" fill="none" stroke="#e2e8f0" strokeWidth="1" />
          </pattern>
          <linearGradient id={`body-${tipo}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#dbeafe" />
          </linearGradient>
          <linearGradient id={`tire-${tipo}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id={`selected-${tipo}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
          <linearGradient id={`spare-${tipo}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width={layout.width - 2} height={layout.height - 2} rx="10" fill={`url(#grid-${tipo})`} opacity="0.72" />
        <rect x={layout.body.x} y={layout.body.y} width={layout.body.width} height={layout.body.height} rx="20" fill={`url(#body-${tipo})`} stroke="#93c5fd" strokeWidth="1.4" />
        <rect x={layout.body.x + 9} y={layout.body.y + 9} width={layout.body.width - 18} height="46" rx="12" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1" />
        <rect x={layout.body.x + 20} y={layout.body.y + 16} width={layout.body.width - 40} height="10" rx="5" fill="#0f172a" opacity="0.88" />
        <rect x={layout.body.x + 13} y={layout.body.y + 68} width={layout.body.width - 26} height={layout.body.height - 86} rx="10" fill="#f8fafc" stroke="#cbd5e1" />
        <line x1={CENTER_X} y1={layout.body.y + 76} x2={CENTER_X} y2={layout.body.y + layout.body.height - 22} stroke="#cbd5e1" strokeWidth="1" />
        <rect x={layout.body.x + 20} y={Math.max(10, layout.body.y - 24)} width="52" height="9" rx="5" fill="#0f172a" opacity="0.9" />
        <rect x={layout.body.x + 17} y={layout.body.y + layout.body.height + 14} width="58" height="9" rx="5" fill="#0f172a" opacity="0.9" />
        {groupAxles(layout.wheels).map((y) => (
          <line key={y} x1={layout.body.x - 10} y1={y} x2={layout.body.x + layout.body.width + 10} y2={y} stroke="#475569" strokeWidth="1.3" strokeLinecap="round" opacity="0.72" />
        ))}
        {layout.wheels.map((item) => {
          const isSelected = selected.includes(item.id);
          const description = DESCRICAO_POSICAO_PNEU[item.id] ?? item.label;
          return (
            <g key={item.id}>
              <title>{`${description}. ${isSelected ? "Selecionada" : "Não selecionada"}.`}</title>
              <rect
                x={item.x}
                y={item.y}
                width={item.width}
                height={item.height}
                rx="7"
                fill={
                  isSelected ? `url(#selected-${tipo})` : item.spare ? `url(#spare-${tipo})` : `url(#tire-${tipo})`
                }
                stroke={isSelected ? "#14b8a6" : item.spare ? "#f59e0b" : "#94a3b8"}
                strokeWidth={isSelected ? 3 : 1.5}
                className="cursor-pointer transition-transform duration-150 hover:scale-[1.04]"
                role="button"
                tabIndex={0}
                aria-label={description}
                aria-pressed={isSelected}
                onClick={() => onToggle(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggle(item.id);
                  }
                }}
              />
              {isSelected ? (
                <text x={item.x + item.width / 2} y={item.y + item.height / 2 + 3} textAnchor="middle" className="pointer-events-none fill-white text-[10px] font-bold">
                  OK
                </text>
              ) : null}
              <text
                x={item.x + item.width / 2}
                y={item.y + item.height + (item.spare ? 18 : 16)}
                textAnchor="middle"
                className={item.spare ? "pointer-events-none fill-amber-600 text-[11px] font-bold" : "pointer-events-none fill-slate-700 text-[11px] font-bold"}
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
        <Legend color="bg-slate-700" label="Disponível" />
        <Legend color="bg-amber-500" label="Estepe" />
        <Legend color="bg-teal-600" label="Selecionado" />
      </div>
    </div>
  );
}

function groupAxles(wheels: Wheel[]): number[] {
  const sorted = wheels
    .filter((item) => !item.spare)
    .map((item) => item.y + item.height / 2)
    .sort((a, b) => a - b);

  return sorted.reduce<number[]>((groups, y) => {
    const last = groups[groups.length - 1];
    if (last != null && Math.abs(last - y) <= 8) {
      groups[groups.length - 1] = Math.round((last + y) / 2);
      return groups;
    }
    groups.push(Math.round(y));
    return groups;
  }, []);
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
