"use client";

import { useState, useEffect } from "react";
import { History, ShieldCheck, UserPlus, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { SEVERITY, type SeverityKey } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type AuditEntry = {
  id: number;
  usuario_id: string;
  acao: string;
  valor_antigo: Record<string, unknown> | null;
  valor_novo: Record<string, unknown> | null;
  alterado_por: string | null;
  alterado_em: string;
};

type Props = {
  usuarioId: string;
  usuarioLabel: string;
};

export function UsuarioAuditoriaDialog({ usuarioId, usuarioLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/administracao/usuarios/auditoria?id=${encodeURIComponent(usuarioId)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: { ok: boolean; entries?: AuditEntry[]; error?: string } = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Erro");
        if (!cancelled) setEntries(json.entries ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar histórico.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, usuarioId]);

  const items: TimelineItem[] = (entries ?? []).map((entry) => {
    const meta = diffSummary(entry.valor_antigo, entry.valor_novo);
    const severity = severityForAction(entry.acao);
    const Icon = entry.acao === "criado" ? UserPlus : PencilLine;
    return {
      id: entry.id,
      title: (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium capitalize">{entry.acao}</span>
          {entry.alterado_por && (
            <span className="text-[11px] text-slate-500">por {entry.alterado_por}</span>
          )}
        </div>
      ),
      description: meta.length ? null : (
        <span className="text-xs text-slate-500">Nenhum campo alterado.</span>
      ),
      timestamp: formatRelative(entry.alterado_em),
      icon: Icon,
      severity,
      meta: meta.length ? (
        <ul className="space-y-1 text-xs">
          {meta.map((m) => (
            <li key={m.field} className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                {m.field}
              </span>
              <span className="text-slate-500 line-through">{m.from}</span>
              <span className="text-slate-400">→</span>
              <span className={cn("font-medium", SEVERITY[severity].soft, "rounded-md px-1.5 py-0.5")}>
                {m.to}
              </span>
            </li>
          ))}
        </ul>
      ) : null,
    };
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-slate-500 hover:text-slate-900">
          <History className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only sm:ml-1.5">Histórico</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">Histórico de alterações</DialogTitle>
              <DialogDescription className="truncate text-xs">{usuarioLabel}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {loading && <div className="py-10 text-center text-sm text-slate-500">Carregando…</div>}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          {!loading && !error && <Timeline items={items} emptyLabel="Sem alterações registradas." />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const TRACKED_FIELDS = ["nome", "email", "matricula", "perfil", "ativo"] as const;

function diffSummary(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): { field: string; from: string; to: string }[] {
  if (!after) return [];
  if (!before) {
    return TRACKED_FIELDS.flatMap((field) => {
      const next = after[field];
      if (next == null || next === "") return [];
      return [{ field: labelFor(field), from: "—", to: stringify(next) }];
    });
  }
  return TRACKED_FIELDS.flatMap((field) => {
    const prev = before[field];
    const next = after[field];
    if (stringify(prev) === stringify(next)) return [];
    return [{ field: labelFor(field), from: stringify(prev), to: stringify(next) }];
  });
}

function severityForAction(acao: string): SeverityKey {
  switch (acao) {
    case "criado":
      return "OK";
    case "atualizado":
      return "INFO";
    case "removido":
    case "deletado":
      return "CRITICO";
    default:
      return "NEUTRO";
  }
}

function labelFor(field: string): string {
  switch (field) {
    case "nome":
      return "Nome";
    case "email":
      return "E-mail";
    case "matricula":
      return "Matrícula";
    case "perfil":
      return "Cargo";
    case "ativo":
      return "Status";
    default:
      return field;
  }
}

function stringify(value: unknown): string {
  if (value === true) return "Ativo";
  if (value === false) return "Inativo";
  if (value == null || value === "") return "—";
  return String(value);
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
