"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Search,
  ShieldAlert,
  Truck,
  Unlock,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import type { PendenciaRow } from "@/lib/repos/checklists";
import {
  abrirManutencaoPendenciaAction,
  liberarFrotaPendenciaAction,
  resolverPendenciaAction,
} from "@/app/(app)/pendencias/_actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";

type ActionKind = "resolver" | "liberar" | "manutencao";
type SelectedAction = { kind: ActionKind; pendencia: PendenciaRow } | null;

const FILTERS = [
  { value: "TODAS", label: "Todas" },
  { value: "CRITICA", label: "Críticas" },
  { value: "MEDIA", label: "Médias" },
  { value: "EM_TRATATIVA", label: "Em tratativa" },
] as const;

const ACTION_COPY: Record<ActionKind, { title: string; confirm: string; description: (frota: string) => string }> = {
  resolver: {
    title: "Resolver pendência?",
    confirm: "Sim, resolver",
    description: (frota) => `A pendência será encerrada, mas o estado operacional da frota ${frota} não será alterado.`,
  },
  liberar: {
    title: "Resolver e liberar a frota?",
    confirm: "Sim, liberar frota",
    description: (frota) => `A pendência será encerrada e a frota ${frota} será liberada caso não existam outros bloqueios.`,
  },
  manutencao: {
    title: "Enviar frota para manutenção?",
    confirm: "Abrir manutenção",
    description: (frota) => `Uma manutenção corretiva será aberta para a frota ${frota} e esta pendência ficará em tratativa.`,
  },
};

export function PendenciasWorkspace({ rows }: { rows: PendenciaRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("TODAS");
  const [selected, setSelected] = useState<SelectedAction>(null);
  const [pending, setPending] = useState(false);

  const stats = useMemo(() => ({
    total: rows.length,
    criticas: rows.filter((row) => row.gravidade === "CRITICA").length,
    tratativa: rows.filter((row) => row.status === "EM_TRATATIVA").length,
    frotas: new Set(rows.map((row) => row.frota_id)).size,
  }), [rows]);

  const filtradas = useMemo(() => {
    const termo = query.trim().toLocaleLowerCase("pt-BR");
    return rows.filter((row) => {
      if (filter === "EM_TRATATIVA" && row.status !== "EM_TRATATIVA") return false;
      if (filter !== "TODAS" && filter !== "EM_TRATATIVA" && row.gravidade !== filter) return false;
      if (!termo) return true;
      return [row.item_nome, row.frota_geral, row.placa, row.motorista_nome, row.motorista_id]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(termo));
    });
  }, [filter, query, rows]);

  async function executeAction() {
    if (!selected) return;
    setPending(true);
    const formData = new FormData();
    formData.set("pendencia_id", String(selected.pendencia.id));

    try {
      const result = selected.kind === "resolver"
        ? await resolverPendenciaAction(formData)
        : selected.kind === "liberar"
          ? await liberarFrotaPendenciaAction(formData)
          : await abrirManutencaoPendenciaAction(formData);

      if (!result.ok) {
        toast.error("Ação não concluída", { description: result.message });
        return;
      }

      toast.success("Ação concluída", { description: result.message });
      setSelected(null);
      router.refresh();
    } catch (error) {
      toast.error("Ação não concluída", {
        description: error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo das pendências">
        <SummaryCard label="Pendências abertas" value={stats.total} icon={ShieldAlert} tone="blue" />
        <SummaryCard label="Críticas" value={stats.criticas} icon={AlertTriangle} tone="red" />
        <SummaryCard label="Em tratativa" value={stats.tratativa} icon={Wrench} tone="amber" />
        <SummaryCard label="Frotas afetadas" value={stats.frotas} icon={Truck} tone="slate" />
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50/70 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">Fila de tratamento</h2>
              <p className="text-xs text-muted-foreground">Priorize, encaminhe e encerre as não conformidades.</p>
            </div>
            <div className="relative w-full xl:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar frota, placa, item ou motorista"
                aria-label="Buscar pendências"
                className="bg-white pl-9"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar pendências">
            {FILTERS.map((item) => {
              const count = item.value === "TODAS"
                ? stats.total
                : item.value === "EM_TRATATIVA"
                  ? stats.tratativa
                  : rows.filter((row) => row.gravidade === item.value).length;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                    filter === item.value
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
                  )}
                >
                  {item.label}
                  <span className={filter === item.value ? "text-blue-100" : "text-slate-400"}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {filtradas.length > 0 ? (
          <div className="divide-y">
            {filtradas.map((pendencia) => {
              const critica = pendencia.gravidade === "CRITICA";
              const emTratativa = pendencia.status === "EM_TRATATIVA";
              const frota = pendencia.frota_geral ?? pendencia.placa ?? String(pendencia.frota_id);

              return (
                <article
                  key={pendencia.id}
                  className={cn(
                    "border-l-4 px-4 py-4 transition-colors hover:bg-slate-50/70 sm:px-5",
                    critica ? "border-l-red-500" : emTratativa ? "border-l-amber-500" : "border-l-blue-400"
                  )}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <AlertTriangle className={cn("h-5 w-5", critica ? "text-red-600" : "text-amber-500")} aria-hidden="true" />
                        <h3 className="font-semibold text-slate-950">{pendencia.item_nome}</h3>
                        <Badge variant="outline" className={critica ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                          {critica ? "Crítica" : "Média"}
                        </Badge>
                        <Badge variant="outline" className={emTratativa ? "border-blue-200 bg-blue-50 text-blue-700" : "bg-white text-slate-600"}>
                          {emTratativa ? "Em tratativa" : "Aberta"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">Frota {frota}</span>
                        {pendencia.placa && pendencia.placa !== frota ? <span>{pendencia.placa}</span> : null}
                        <span>Motorista: {pendencia.motorista_nome ?? pendencia.motorista_id ?? "Não informado"}</span>
                        <span>Criada em {formatDate(pendencia.criado_em)}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {pendencia.checklist_id ? (
                        <Button asChild type="button" variant="ghost" size="sm" className="text-slate-600">
                          <Link href={`/checklists/${pendencia.checklist_id}`}>
                            <ClipboardCheck aria-hidden="true" />
                            Checklist
                          </Link>
                        </Button>
                      ) : null}
                      <Button asChild type="button" variant="ghost" size="sm" className="text-slate-600">
                        <Link href={`/frotas/${pendencia.frota_id}`}>
                          <ExternalLink aria-hidden="true" />
                          Ver frota
                        </Link>
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelected({ kind: "liberar", pendencia })}>
                        <Unlock aria-hidden="true" />
                        Liberar frota
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={emTratativa}
                        onClick={() => setSelected({ kind: "manutencao", pendencia })}
                      >
                        <Wrench aria-hidden="true" />
                        {emTratativa ? "Em manutenção" : "Abrir manutenção"}
                      </Button>
                      <Button type="button" size="sm" onClick={() => setSelected({ kind: "resolver", pendencia })}>
                        <CheckCircle2 aria-hidden="true" />
                        Resolver
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={rows.length === 0 ? CheckCircle2 : Search}
            title={rows.length === 0 ? "Nenhuma pendência aberta" : "Nenhuma pendência encontrada"}
            description={rows.length === 0 ? "A operação está em dia." : "Tente outro termo ou filtro."}
            className="m-4"
          />
        )}
      </section>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && !pending && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{ACTION_COPY[selected.kind].title}</DialogTitle>
                <DialogDescription className="pt-2">
                  {ACTION_COPY[selected.kind].description(
                    selected.pendencia.frota_geral ?? selected.pendencia.placa ?? String(selected.pendencia.frota_id)
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" disabled={pending} onClick={() => setSelected(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  variant={selected.kind === "liberar" ? "destructive" : "default"}
                  onClick={executeAction}
                >
                  {pending ? "Processando..." : ACTION_COPY[selected.kind].confirm}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof ShieldAlert;
  tone: "blue" | "red" | "amber" | "slate";
}) {
  const colors = {
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    slate: "border-slate-200 bg-white text-slate-800",
  };

  return (
    <div className={cn("rounded-xl border p-4 shadow-sm", colors[tone])}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="mt-0.5 text-xs font-medium">{label}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/70 ring-1 ring-current/10">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
