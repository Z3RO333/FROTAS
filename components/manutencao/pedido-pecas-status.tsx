import { cn } from "@/lib/utils";
import type { PedidoPecasEnvioStatus, PedidoPecasStatus } from "@/lib/repos/pedidos-pecas";

const LABELS: Record<PedidoPecasStatus | PedidoPecasEnvioStatus, string> = {
  PENDENTE_ENVIO: "Pendente de envio",
  ENVIANDO: "Enviando",
  ENVIADO: "Enviado",
  PARCIAL: "Envio parcial",
  ERRO_ENVIO: "Erro no envio",
  PENDENTE: "Pendente",
  ERRO: "Erro",
};

export function PedidoPecasStatusBadge({
  status,
}: {
  status: PedidoPecasStatus | PedidoPecasEnvioStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset",
        status === "ENVIADO" && "bg-emerald-50 text-emerald-800 ring-emerald-200",
        (status === "PENDENTE" || status === "PENDENTE_ENVIO" || status === "ENVIANDO") &&
          "bg-blue-50 text-blue-800 ring-blue-200",
        status === "PARCIAL" && "bg-amber-50 text-amber-800 ring-amber-200",
        (status === "ERRO" || status === "ERRO_ENVIO") && "bg-red-50 text-red-800 ring-red-200"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "ENVIADO" && "bg-emerald-500",
          (status === "PENDENTE" || status === "PENDENTE_ENVIO" || status === "ENVIANDO") &&
            "bg-blue-500",
          status === "PARCIAL" && "bg-amber-500",
          (status === "ERRO" || status === "ERRO_ENVIO") && "bg-red-500"
        )}
      />
      {LABELS[status]}
    </span>
  );
}
