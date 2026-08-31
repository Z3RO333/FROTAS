"use client";

import { useState } from "react";
import { Camera, CheckCircle2, Clock, ClipboardCheck, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterChip, FilterSearch } from "@/components/ui/filter-bar";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { cn } from "@/lib/utils";
import { formatDuracao, TIPO_ATIVIDADE_LABELS } from "@/lib/atividades/rules";
import type { AtividadeManutencao } from "@/lib/repos/atividades-manutencao";
import type { SeverityKey } from "@/lib/design/tokens";

type FiltroAtividade = "TODAS" | "PENDENTE" | "CONCLUIDA" | "LEVAR_PARA";

const FILTER_CHIPS: { label: string; value: FiltroAtividade; severity?: SeverityKey }[] = [
  { label: "Todas", value: "TODAS" },
  { label: "Pendentes", value: "PENDENTE", severity: "ATENCAO" },
  { label: "Concluídas", value: "CONCLUIDA", severity: "OK" },
  { label: "Levar para", value: "LEVAR_PARA" },
];

function todayIsoPrefix(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AtividadesClient({
  atividades,
  limit,
}: {
  atividades: AtividadeManutencao[];
  limit: number;
}) {
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<FiltroAtividade>("TODAS");

  const today = todayIsoPrefix();

  const kpis = {
    pendentes: atividades.filter((a) => a.status === "PENDENTE").length,
    concluidasHoje: atividades.filter(
      (a) => a.status === "CONCLUIDA" && a.concluido_em?.slice(0, 10) === today
    ).length,
    total: atividades.length,
  };

  const filtered = atividades.filter((a) => {
    const q = query.trim().toLowerCase();
    if (q) {
      const matchFrota = a.frota_codigo.toLowerCase().includes(q);
      const matchMotorista = a.motorista_nomes.some((n) => n.toLowerCase().includes(q));
      if (!matchFrota && !matchMotorista) return false;
    }
    if (filtro === "PENDENTE" && a.status !== "PENDENTE") return false;
    if (filtro === "CONCLUIDA" && a.status !== "CONCLUIDA") return false;
    if (filtro === "LEVAR_PARA" && a.tipo !== "LEVAR_PARA") return false;
    return true;
  });

  return (
    <>
      <MetricGrid cols={3}>
        <MetricCard
          label="Pendentes"
          value={kpis.pendentes}
          icon={Clock}
          severity="ATENCAO"
          onClick={() => setFiltro("PENDENTE")}
        />
        <MetricCard
          label="Concluídas hoje"
          value={kpis.concluidasHoje}
          icon={CheckCircle2}
          severity="OK"
          onClick={() => setFiltro("CONCLUIDA")}
        />
        <MetricCard
          label="Total"
          value={kpis.total}
          icon={Layers}
          severity="NEUTRO"
        />
      </MetricGrid>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Todas as atividades</h2>

        <FilterBar sticky>
          <FilterSearch
            value={query}
            onChange={setQuery}
            placeholder="Frota ou motorista…"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_CHIPS.map((chip) => {
              const count =
                chip.value === "TODAS"
                  ? atividades.length
                  : chip.value === "PENDENTE"
                  ? atividades.filter((a) => a.status === "PENDENTE").length
                  : chip.value === "CONCLUIDA"
                  ? atividades.filter((a) => a.status === "CONCLUIDA").length
                  : atividades.filter((a) => a.tipo === "LEVAR_PARA").length;
              return (
                <FilterChip
                  key={chip.value}
                  label={chip.label}
                  count={count}
                  active={filtro === chip.value}
                  severity={filtro === chip.value ? chip.severity : undefined}
                  onClick={() => setFiltro(chip.value)}
                />
              );
            })}
          </div>
        </FilterBar>

        {filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhuma atividade encontrada"
            description={
              query
                ? "Tente outro termo de busca."
                : filtro !== "TODAS"
                ? "Nenhuma atividade para este filtro."
                : "Crie a primeira atividade acima."
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((a) => (
              <AtividadeCard key={a.id} atividade={a} />
            ))}
            {atividades.length >= limit && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Exibindo os {limit} registros mais recentes.
              </p>
            )}
          </div>
        )}
      </section>
    </>
  );
}

function AtividadeCard({ atividade }: { atividade: AtividadeManutencao }) {
  const isPendente = atividade.status === "PENDENTE";
  const isLevarPara = atividade.tipo === "LEVAR_PARA";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4",
        "shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)]",
        isPendente ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-emerald-500"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Frota + badge de status */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{atividade.frota_codigo}</span>
            <Badge
              variant="outline"
              className={
                isPendente
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }
            >
              {isPendente ? "Pendente" : "Concluída"}
            </Badge>
          </div>

          {/* Tipo + local */}
          <p className="text-sm text-slate-700">
            {TIPO_ATIVIDADE_LABELS[atividade.tipo]}
            {atividade.local ? ` — ${atividade.local}` : ""}
          </p>

          {/* Badges de motoristas — destaca quem concluiu */}
          <div className="flex flex-wrap gap-1.5">
            {atividade.motorista_nomes.map((nome) => {
              const isConcluidor = !isPendente && atividade.concluido_por_nome === nome;
              return (
                <span
                  key={nome}
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    isConcluidor
                      ? "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-300"
                      : "bg-slate-100 text-slate-700"
                  )}
                >
                  {isConcluidor ? `${nome} ✓` : nome}
                </span>
              );
            })}
          </div>

          {/* Duração + link de foto (exclusivos de LEVAR_PARA concluída) */}
          {!isPendente && isLevarPara && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {atividade.concluido_em && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {formatDuracao(atividade.criado_em, atividade.concluido_em)}
                </span>
              )}
              {atividade.foto_conclusao_path && (
                <FotoLink atividadeId={atividade.id} />
              )}
            </div>
          )}

          {/* Observação */}
          {atividade.observacao && (
            <p className="text-xs italic text-slate-400">{atividade.observacao}</p>
          )}
        </div>

        {/* Data de criação */}
        <span className="shrink-0 text-[11px] text-slate-400">
          {new Date(atividade.criado_em).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

// A rota assina a URL sob demanda e redireciona, então um link simples basta —
// sem JS, sem bloqueador de pop-up e sem custo de assinar fotos que ninguém abre.
function FotoLink({ atividadeId }: { atividadeId: number }) {
  return (
    <a
      href={`/api/atividades/${atividadeId}/foto`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-blue-700 hover:underline"
    >
      <Camera className="h-3 w-3" aria-hidden="true" />
      Ver foto
    </a>
  );
}
