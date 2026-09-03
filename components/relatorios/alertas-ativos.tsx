"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Search,
  Truck,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import type { AlertaRow } from "@/lib/repos/alertas";
import { resolverAlertaAction } from "@/app/(app)/relatorios/checklists/_actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TIPO_CONFIG: Record<
  string,
  { label: string; badge: string; border: string; icon: typeof AlertTriangle }
> = {
  CRITICO: {
    label: "Crítico",
    badge: "bg-red-50 text-red-700 ring-red-200",
    border: "border-l-red-500",
    icon: AlertTriangle,
  },
  MANUTENCAO: {
    label: "Manutenção",
    badge: "bg-orange-50 text-orange-700 ring-orange-200",
    border: "border-l-orange-500",
    icon: Wrench,
  },
  BLOQUEIO_SUGERIDO: {
    label: "Bloqueio sugerido",
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    border: "border-l-rose-600",
    icon: AlertTriangle,
  },
  KM_ANOMALO: {
    label: "KM anômalo",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    border: "border-l-amber-500",
    icon: AlertTriangle,
  },
};

const FILTERS = [
  { value: "TODOS", label: "Todos" },
  { value: "CRITICO", label: "Críticos" },
  { value: "MANUTENCAO", label: "Manutenção" },
  { value: "BLOQUEIO_SUGERIDO", label: "Bloqueio" },
  { value: "KM_ANOMALO", label: "KM anômalo" },
] as const;

export function AlertasAtivos({ alertas }: { alertas: AlertaRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<string>("TODOS");
  const [pendingId, setPendingId] = useState<number | null>(null);

  const filtrados = useMemo(() => {
    const termo = query.trim().toLocaleLowerCase("pt-BR");
    return alertas.filter((alerta) => {
      if (tipo !== "TODOS" && alerta.tipo !== tipo) return false;
      if (!termo) return true;
      return [alerta.titulo, alerta.descricao, alerta.frota_geral, alerta.placa]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(termo));
    });
  }, [alertas, query, tipo]);

  async function resolver(alerta: AlertaRow) {
    setPendingId(alerta.id);
    try {
      const formData = new FormData();
      formData.set("alerta_id", String(alerta.id));
      formData.set("status", "RESOLVIDO");
      const result = await resolverAlertaAction(formData);

      if (!result.ok) {
        toast.error("Não foi possível resolver", { description: result.message });
        return;
      }

      toast.success("Alerta resolvido", {
        description: `Frota ${alerta.frota_geral ?? alerta.placa ?? alerta.frota_id} atualizada.`,
      });
      router.refresh();
    } catch (error) {
      toast.error("Não foi possível resolver", {
        description: error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
      });
    } finally {
      setPendingId(null);
    }
  }

  if (alertas.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Operação sem alertas abertos"
        description="Novos alertas gerados pelas análises aparecerão aqui."
        className="border-emerald-200 bg-emerald-50/60"
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b bg-slate-50/70 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-950">Alertas para decisão</h2>
              <p className="text-xs text-muted-foreground">
                {alertas.length} {alertas.length === 1 ? "ocorrência aberta" : "ocorrências abertas"}
              </p>
            </div>
          </div>

          <div className="relative w-full xl:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar frota, placa ou alerta"
              aria-label="Buscar alertas"
              className="bg-white pl-9"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar alertas por tipo">
          {FILTERS.map((filter) => {
            const count = filter.value === "TODOS"
              ? alertas.length
              : alertas.filter((alerta) => alerta.tipo === filter.value).length;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setTipo(filter.value)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  tipo === filter.value
                    ? "border-blue-700 bg-blue-700 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
                )}
              >
                {filter.label}
                <span className={cn("tabular-nums", tipo === filter.value ? "text-blue-100" : "text-slate-400")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filtrados.length > 0 ? (
        <div className="divide-y">
          {filtrados.map((alerta) => {
            const config = TIPO_CONFIG[alerta.tipo] ?? TIPO_CONFIG.CRITICO;
            const Icon = config.icon;
            const frota = alerta.frota_geral ?? alerta.placa ?? String(alerta.frota_id);

            return (
              <article
                key={alerta.id}
                className={cn("border-l-4 px-4 py-4 transition-colors hover:bg-slate-50/70 sm:px-5", config.border)}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", config.badge)}>
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {config.label}
                      </span>
                      <h3 className="font-semibold text-slate-950">{alerta.titulo}</h3>
                    </div>
                    {alerta.descricao ? (
                      <p className="max-w-4xl text-sm leading-5 text-slate-600">{alerta.descricao}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                        Frota {frota}
                      </span>
                      {alerta.placa && alerta.placa !== frota ? <span>{alerta.placa}</span> : null}
                      <span>{new Date(alerta.criado_em).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {alerta.checklist_id ? (
                      <Button asChild type="button" variant="outline" size="sm">
                        <Link href={`/checklists/${alerta.checklist_id}`}>
                          <ClipboardCheck aria-hidden="true" />
                          Checklist
                        </Link>
                      </Button>
                    ) : null}
                    <Button asChild type="button" variant="outline" size="sm">
                      <Link href={`/frotas/${alerta.frota_id}`}>
                        <ExternalLink aria-hidden="true" />
                        Ver frota
                      </Link>
                    </Button>
                    <ConfirmDialog
                      title="Resolver este alerta?"
                      description={`O alerta “${alerta.titulo}” da frota ${frota} sairá da lista de abertos.`}
                      confirmLabel="Sim, resolver"
                      onConfirm={() => resolver(alerta)}
                      trigger={
                        <Button type="button" size="sm" disabled={pendingId !== null}>
                          <CheckCircle2 aria-hidden="true" />
                          {pendingId === alerta.id ? "Resolvendo..." : "Resolver"}
                        </Button>
                      }
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="Nenhum alerta encontrado"
          description="Tente outro termo ou selecione um tipo diferente."
          className="m-4"
        />
      )}
    </section>
  );
}
