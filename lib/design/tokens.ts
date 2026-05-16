export const SEVERITY = {
  OK: {
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    card: "bg-emerald-50 border-emerald-200 text-emerald-900",
    icon: "text-emerald-600",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    tile: "bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100",
    glow: "shadow-[0_8px_24px_-12px_rgba(16,185,129,0.45)]",
    ring: "ring-emerald-200",
    soft: "bg-emerald-500/10 text-emerald-700",
  },
  ATENCAO: {
    badge: "bg-amber-50 text-amber-900 ring-amber-200",
    card: "bg-amber-50 border-amber-200 text-amber-900",
    icon: "text-amber-600",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    tile: "bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100",
    glow: "shadow-[0_8px_24px_-12px_rgba(245,158,11,0.45)]",
    ring: "ring-amber-200",
    soft: "bg-amber-500/10 text-amber-700",
  },
  CRITICO: {
    badge: "bg-red-50 text-red-800 ring-red-200",
    card: "bg-red-50 border-red-200 text-red-900",
    icon: "text-red-600",
    dot: "bg-red-500",
    bar: "bg-red-500",
    tile: "bg-red-50 text-red-600 ring-1 ring-inset ring-red-100",
    glow: "shadow-[0_8px_24px_-12px_rgba(239,68,68,0.45)]",
    ring: "ring-red-200",
    soft: "bg-red-500/10 text-red-700",
  },
  MANUTENCAO: {
    badge: "bg-violet-50 text-violet-800 ring-violet-200",
    card: "bg-violet-50 border-violet-200 text-violet-900",
    icon: "text-violet-600",
    dot: "bg-violet-500",
    bar: "bg-violet-500",
    tile: "bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100",
    glow: "shadow-[0_8px_24px_-12px_rgba(139,92,246,0.45)]",
    ring: "ring-violet-200",
    soft: "bg-violet-500/10 text-violet-700",
  },
  BLOQUEIO: {
    badge: "bg-rose-100 text-rose-900 ring-rose-300 font-bold",
    card: "bg-rose-50 border-rose-300 text-rose-900",
    icon: "text-rose-700",
    dot: "bg-rose-600",
    bar: "bg-rose-600",
    tile: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
    glow: "shadow-[0_8px_24px_-12px_rgba(225,29,72,0.5)]",
    ring: "ring-rose-300",
    soft: "bg-rose-500/10 text-rose-700",
  },
  NEUTRO: {
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    card: "bg-slate-50 border-slate-200 text-slate-700",
    icon: "text-slate-500",
    dot: "bg-slate-400",
    bar: "bg-slate-400",
    tile: "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200",
    glow: "shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]",
    ring: "ring-slate-200",
    soft: "bg-slate-500/10 text-slate-700",
  },
  INFO: {
    badge: "bg-blue-50 text-blue-800 ring-blue-200",
    card: "bg-blue-50 border-blue-200 text-blue-900",
    icon: "text-blue-600",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
    tile: "bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100",
    glow: "shadow-[0_8px_24px_-12px_rgba(59,130,246,0.45)]",
    ring: "ring-blue-200",
    soft: "bg-blue-500/10 text-blue-700",
  },
} as const;

export type SeverityKey = keyof typeof SEVERITY;

const STATUS_TO_SEVERITY: Record<string, SeverityKey> = {
  NO_PRAZO: "OK",
  OK: "OK",
  APROVADO: "OK",
  LAVAGEM: "OK",
  DISPONIVEL: "OK",
  COM_OBSERVACAO: "ATENCAO",
  ATENCAO: "ATENCAO",
  PREVENTIVA: "ATENCAO",
  PENDENTE: "ATENCAO",
  ALINHAMENTO: "ATENCAO",
  EMBREAGEM: "ATENCAO",
  TACOGRAFO: "ATENCAO",
  ATRASADO: "CRITICO",
  ATRASADA: "CRITICO",
  VENCIDO: "CRITICO",
  CRITICO: "CRITICO",
  CRITICA: "CRITICO",
  ALTA: "CRITICO",
  MEDIA: "ATENCAO",
  BAIXA: "INFO",
  NAO_APTO: "CRITICO",
  EM_MANUTENCAO: "MANUTENCAO",
  MANUTENCAO: "MANUTENCAO",
  BLOQUEIO_SUGERIDO: "BLOQUEIO",
  BLOQUEADA: "BLOQUEIO",
  BLOQUEADO: "BLOQUEIO",
};

export function severityFromStatus(status: string | null | undefined): SeverityKey {
  if (!status) return "NEUTRO";
  const key = status.trim().toUpperCase().replace(/\s+/g, "_");
  return STATUS_TO_SEVERITY[key] ?? "NEUTRO";
}

export function formatStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return status.trim().replace(/_/g, " ");
}
