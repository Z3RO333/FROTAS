import { PERFIL_LABELS, type PerfilUsuario } from "@/lib/perfis";
import { SEVERITY, type SeverityKey } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

const PERFIL_SEVERITY: Record<PerfilUsuario, SeverityKey> = {
  MOTORISTA: "INFO",
  PORTARIA: "ATENCAO",
  APROVADOR: "OK",
  MANUTENCAO: "MANUTENCAO",
  GESTOR: "OK",
  ADMIN: "BLOQUEIO",
  DEV: "NEUTRO",
};

type Size = "sm" | "md";

export function PerfilBadge({
  perfil,
  size = "md",
  className,
}: {
  perfil: PerfilUsuario;
  size?: Size;
  className?: string;
}) {
  const severity = PERFIL_SEVERITY[perfil];
  const tone = SEVERITY[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md font-semibold uppercase tracking-wide ring-1 ring-inset whitespace-nowrap",
        tone.badge,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden="true" />
      {PERFIL_LABELS[perfil]}
    </span>
  );
}
