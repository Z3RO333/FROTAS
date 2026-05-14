export const SEVERITY = {
  OK:        { badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",  card: "bg-emerald-50 border-emerald-200 text-emerald-900",  icon: "text-emerald-600",  dot: "bg-emerald-500" },
  ATENCAO:   { badge: "bg-amber-50 text-amber-900 ring-amber-200",        card: "bg-amber-50 border-amber-200 text-amber-900",        icon: "text-amber-600",    dot: "bg-amber-500" },
  CRITICO:   { badge: "bg-red-50 text-red-800 ring-red-200",              card: "bg-red-50 border-red-200 text-red-900",              icon: "text-red-600",      dot: "bg-red-500" },
  MANUTENCAO:{ badge: "bg-violet-50 text-violet-800 ring-violet-200",     card: "bg-violet-50 border-violet-200 text-violet-900",     icon: "text-violet-600",   dot: "bg-violet-500" },
  BLOQUEIO:  { badge: "bg-rose-100 text-rose-900 ring-rose-300 font-bold",card: "bg-rose-50 border-rose-300 text-rose-900",           icon: "text-rose-700",     dot: "bg-rose-600" },
  NEUTRO:    { badge: "bg-slate-100 text-slate-700 ring-slate-200",       card: "bg-slate-50 border-slate-200 text-slate-700",        icon: "text-slate-500",    dot: "bg-slate-400" },
  INFO:      { badge: "bg-blue-50 text-blue-800 ring-blue-200",           card: "bg-blue-50 border-blue-200 text-blue-900",           icon: "text-blue-600",     dot: "bg-blue-500" },
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
