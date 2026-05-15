# Portaria Redesign — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a tela de Portaria em uma central operacional única onde o usuário vê os veículos aguardando ação, clica em qualquer um para ver o checklist completo com fotos e itens, e libera/bloqueia diretamente — sem precisar de outras abas.

**Architecture:** A página de portaria continua como Server Component para a listagem, mas adiciona um Sheet (painel lateral) client-side que carrega os detalhes do checklist via Server Action ao clicar no veículo. Novas ações de portaria (bloquear com justificativa, solicitar correção) são adicionadas como Server Actions e registradas em `movimentacoes_frota` com o campo `tipo_acao`. Filtros por status são tabs na página.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase/PostgreSQL, shadcn/ui Sheet, Tailwind CSS.

**Estado atual relevante:**
- `app/(app)/portaria/page.tsx` — Server Component com tabela + 4 KPIs + botões de SAIDA/ENTRADA
- `app/(app)/portaria/_actions.ts` — `registrarMovimentacaoPortariaAction` com try/catch + redirect
- `lib/repos/checklists.ts` — `listPortariaToday()` retorna `PortariaRow[]`; `listChecklistItems(id)` retorna `ChecklistItemRow[]`
- `lib/repos/checklist-images.ts` — tabela `checklist_image_inspections` com `storage_path`
- `movimentacoes_frota` — tem `frota_id, motorista_id, checklist_id, tipo_movimentacao, data_hora, usuario_portaria_id, observacao`
- Bucket Supabase Storage: `checklist-images` (privado)
- `StatusPortaria`: PENDENTE_CHECKLIST | CHECKLIST_REALIZADO | LIBERADA_SAIDA | BLOQUEADA_CHECKLIST | BLOQUEADA_MANUTENCAO | SAIDA_REGISTRADA | ENTRADA_REGISTRADA

---

## Mapa de arquivos

| Arquivo | Status | Responsabilidade |
|---------|--------|-----------------|
| `supabase/migrations/016_portaria_acoes.sql` | Criar | Adiciona `tipo_acao` + `motivo_bloqueio` em `movimentacoes_frota` |
| `lib/repos/portaria-detail.ts` | Criar | `getChecklistDetalhePortaria()` — items + fotos assinadas + histórico |
| `app/(app)/portaria/veiculo-sheet.tsx` | Criar | Sheet client com todo detalhe do veículo/checklist + ações |
| `app/(app)/portaria/_actions.ts` | Modificar | Adicionar `bloquearSaidaAction`, `solicitarCorrecaoAction` |
| `app/(app)/portaria/page.tsx` | Modificar | Tornar linhas clicáveis + filtro por status + passar dados ao sheet |

---

## Task 1: Migration — `tipo_acao` e `motivo_bloqueio` em movimentacoes_frota

**Arquivos:**
- Criar: `supabase/migrations/016_portaria_acoes.sql`

- [ ] **Criar `supabase/migrations/016_portaria_acoes.sql`**

```sql
-- Migration 016: Ações da portaria além de SAIDA/ENTRADA

ALTER TABLE public.movimentacoes_frota
  ADD COLUMN IF NOT EXISTS tipo_acao text
    CHECK (tipo_acao IN ('SAIDA','ENTRADA','BLOQUEIO','SOLICITACAO_CORRECAO','OBSERVACAO'))
    DEFAULT 'SAIDA',
  ADD COLUMN IF NOT EXISTS motivo_bloqueio text;

-- Preenche tipo_acao nos registros existentes com base em tipo_movimentacao
UPDATE public.movimentacoes_frota
  SET tipo_acao = tipo_movimentacao
  WHERE tipo_acao IS NULL OR tipo_acao = 'SAIDA';

-- Índice para busca de histórico por frota + ação
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo_acao
  ON public.movimentacoes_frota (frota_id, tipo_acao, data_hora DESC);
```

- [ ] **Aplicar via Supabase MCP**

```
mcp__claude_ai_Supabase__apply_migration(
  project_id: "nwoqastjgkgsifmxdqwp",
  name: "016_portaria_acoes",
  query: <conteúdo SQL acima>
)
```

- [ ] **Verificar via execute_sql**

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'movimentacoes_frota' 
  AND column_name IN ('tipo_acao', 'motivo_bloqueio');
```

Deve retornar 2 linhas.

- [ ] **Commit**

```bash
git add supabase/migrations/016_portaria_acoes.sql
git commit -m "feat(db): tipo_acao e motivo_bloqueio em movimentacoes_frota para ações de portaria"
```

---

## Task 2: Repositório `lib/repos/portaria-detail.ts`

**Arquivos:**
- Criar: `lib/repos/portaria-detail.ts`

- [ ] **Criar `lib/repos/portaria-detail.ts`**

```typescript
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { listChecklistItems, type ChecklistItemRow } from "@/lib/repos/checklists";

export type FotoChecklist = {
  id: string;
  source_type: "hodometro" | "item" | "abastecimento";
  checklist_item_codigo: string | null;
  signed_url: string | null;
  storage_path: string;
};

export type HistoricoMovimentacao = {
  id: number;
  tipo_acao: string;
  motivo_bloqueio: string | null;
  observacao: string | null;
  usuario_portaria_id: string | null;
  data_hora: string;
};

export type ChecklistDetalhePortaria = {
  checklist_id: number;
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  modelo: string | null;
  motorista_nome: string | null;
  motorista_id: string | null;
  km_informado: number | null;
  km_anterior: number | null;
  status_geral: string | null;
  observacao_original: string | null;
  observacao_corrigida_ia: string | null;
  criado_em: string | null;
  itens: ChecklistItemRow[];
  fotos: FotoChecklist[];
  historico_hoje: HistoricoMovimentacao[];
};

export async function getChecklistDetalhePortaria(
  checklistId: number,
  frotaId: number
): Promise<ChecklistDetalhePortaria | null> {
  // Busca dados do checklist + veículo em paralelo
  const [checklistResult, itens, imagensResult, historicoResult] = await Promise.all([
    supabaseManutencao
      .from("checklists_frota")
      .select(`
        id, frota_id, motorista_id, motorista_nome,
        km_informado, status_geral, observacao_original,
        observacao_corrigida_ia, criado_em,
        veiculos!inner(codigo_frota, placa, modelo, km_atual)
      `)
      .eq("id", checklistId)
      .single(),

    listChecklistItems(checklistId),

    supabaseManutencao
      .from("checklist_image_inspections")
      .select("id, source_type, checklist_item_codigo, storage_path")
      .eq("checklist_id", checklistId),

    // Histórico de ações da portaria para esta frota hoje
    supabaseManutencao
      .from("movimentacoes_frota")
      .select("id, tipo_acao, motivo_bloqueio, observacao, usuario_portaria_id, data_hora")
      .eq("frota_id", frotaId)
      .order("data_hora", { ascending: false })
      .limit(10),
  ]);

  if (checklistResult.error || !checklistResult.data) {
    console.warn("[portaria-detail] checklist não encontrado", checklistResult.error?.message);
    return null;
  }

  const c = checklistResult.data;
  const veiculo = (c as { veiculos?: { codigo_frota?: string | null; placa?: string | null; modelo?: string | null; km_atual?: number | null } }).veiculos ?? {};

  // Gera URLs assinadas para as fotos (1 hora de validade)
  const imagens = imagensResult.data ?? [];
  const fotos: FotoChecklist[] = await Promise.all(
    imagens.map(async (img) => {
      const { data: signed } = await supabaseManutencao.storage
        .from("checklist-images")
        .createSignedUrl(img.storage_path, 3600);
      return {
        id: img.id,
        source_type: img.source_type as FotoChecklist["source_type"],
        checklist_item_codigo: img.checklist_item_codigo ?? null,
        storage_path: img.storage_path,
        signed_url: signed?.signedUrl ?? null,
      };
    })
  );

  return {
    checklist_id: checklistId,
    frota_id: frotaId,
    frota_geral: veiculo.codigo_frota ?? null,
    placa: veiculo.placa ?? null,
    modelo: veiculo.modelo ?? null,
    motorista_nome: c.motorista_nome ?? null,
    motorista_id: c.motorista_id ?? null,
    km_informado: c.km_informado != null ? Number(c.km_informado) : null,
    km_anterior: veiculo.km_atual != null ? Number(veiculo.km_atual) : null,
    status_geral: c.status_geral ?? null,
    observacao_original: c.observacao_original ?? null,
    observacao_corrigida_ia: c.observacao_corrigida_ia ?? null,
    criado_em: c.criado_em ?? null,
    itens,
    fotos,
    historico_hoje: (historicoResult.data ?? []).map((h) => ({
      id: Number(h.id),
      tipo_acao: h.tipo_acao ?? "SAIDA",
      motivo_bloqueio: h.motivo_bloqueio ?? null,
      observacao: h.observacao ?? null,
      usuario_portaria_id: h.usuario_portaria_id ?? null,
      data_hora: h.data_hora,
    })),
  };
}
```

- [ ] **Verificar TypeScript**

```bash
cd c:\frotas && npx tsc --noEmit 2>&1 | grep -v ".next/dev"
# Deve passar sem erros
```

- [ ] **Commit**

```bash
git add lib/repos/portaria-detail.ts
git commit -m "feat(repo): getChecklistDetalhePortaria — itens, fotos assinadas e histórico"
```

---

## Task 3: Server Actions — bloquear e solicitar correção

**Arquivos:**
- Modificar: `app/(app)/portaria/_actions.ts`

- [ ] **Ler o arquivo atual**

Leia `app/(app)/portaria/_actions.ts` para entender o código existente antes de editar.

- [ ] **Adicionar `bloquearSaidaAction` e `solicitarCorrecaoAction` ao `_actions.ts`**

Adicione estas duas funções depois da `registrarMovimentacaoPortariaAction` existente:

```typescript
export async function bloquearSaidaAction(formData: FormData) {
  try {
    const user = await requirePortariaUser();
    const frotaId = Number(formData.get("frota_id"));
    const checklistId = Number(formData.get("checklist_id"));
    const motivo = String(formData.get("motivo") ?? "").trim();
    const rows = await listPortariaToday();
    const row = rows.find((r) => r.frota_id === frotaId && r.checklist_id === checklistId);

    if (!row) {
      redirect(`/portaria?erro=${encodeURIComponent("Frota não encontrada.")}`);
    }

    await registrarMovimentacaoFrota({
      frota_id: frotaId,
      checklist_id: checklistId,
      motorista_id: row!.motorista_id!,
      tipo_movimentacao: "SAIDA",
      usuario_portaria_id: user.email,
      observacao: motivo || null,
      tipo_acao: "BLOQUEIO",
      motivo_bloqueio: motivo || null,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const msg = error instanceof Error ? error.message : "Erro ao bloquear saída.";
    redirect(`/portaria?erro=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/portaria");
}

export async function solicitarCorrecaoAction(formData: FormData) {
  try {
    const user = await requirePortariaUser();
    const frotaId = Number(formData.get("frota_id"));
    const checklistId = Number(formData.get("checklist_id"));
    const motivo = String(formData.get("motivo") ?? "").trim();
    const rows = await listPortariaToday();
    const row = rows.find((r) => r.frota_id === frotaId && r.checklist_id === checklistId);

    if (!row) {
      redirect(`/portaria?erro=${encodeURIComponent("Frota não encontrada.")}`);
    }

    await registrarMovimentacaoFrota({
      frota_id: frotaId,
      checklist_id: checklistId,
      motorista_id: row!.motorista_id!,
      tipo_movimentacao: "SAIDA",
      usuario_portaria_id: user.email,
      observacao: motivo || null,
      tipo_acao: "SOLICITACAO_CORRECAO",
      motivo_bloqueio: motivo || null,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const msg = error instanceof Error ? error.message : "Erro ao solicitar correção.";
    redirect(`/portaria?erro=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/portaria");
}
```

- [ ] **Atualizar `RegistrarMovimentacaoInput` em `lib/repos/checklists.ts`**

Localize o tipo `RegistrarMovimentacaoInput` e adicione os campos opcionais:

```typescript
export type RegistrarMovimentacaoInput = {
  frota_id: number;
  motorista_id: string;
  checklist_id: number;
  tipo_movimentacao: "SAIDA" | "ENTRADA";
  usuario_portaria_id: string;
  observacao?: string | null;
  tipo_acao?: string | null;       // ADD
  motivo_bloqueio?: string | null; // ADD
};
```

- [ ] **Atualizar `registrarMovimentacaoFrota` para passar os novos campos**

Na função `registrarMovimentacaoFrota`, no objeto `.insert({...})`, adicionar:
```typescript
tipo_acao: input.tipo_acao ?? input.tipo_movimentacao,
motivo_bloqueio: input.motivo_bloqueio ?? null,
```

- [ ] **Verificar TypeScript**

```bash
cd c:\frotas && npx tsc --noEmit 2>&1 | grep -v ".next/dev"
```

- [ ] **Commit**

```bash
git add app/(app)/portaria/_actions.ts lib/repos/checklists.ts
git commit -m "feat(portaria): ações bloquear saída e solicitar correção com motivo"
```

---

## Task 4: Componente VeiculoSheet

**Arquivos:**
- Criar: `app/(app)/portaria/veiculo-sheet.tsx`

- [ ] **Criar `app/(app)/portaria/veiculo-sheet.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Gauge, Truck, User,
  XCircle, ChevronRight, Image as ImageIcon, MessageSquare,
  Lock, RefreshCw, LogOut, LogIn,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import {
  registrarMovimentacaoPortariaAction,
  bloquearSaidaAction,
  solicitarCorrecaoAction,
} from "./portaria-actions-client";
import type { ChecklistDetalhePortaria } from "@/lib/repos/portaria-detail";
import type { StatusPortaria } from "@/lib/repos/checklists";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detalhe: ChecklistDetalhePortaria | null;
  loading: boolean;
  statusPortaria: StatusPortaria | null;
  frotaId: number | null;
};

const STATUS_ITEM_CLASS = {
  APTO: "text-emerald-600",
  NAO_APTO: "text-red-600 font-semibold",
  NAO_SE_APLICA: "text-slate-400",
} as const;

const STATUS_GERAL_CLASS: Record<string, string> = {
  APROVADO: "border-emerald-200 bg-emerald-50 text-emerald-800",
  COM_OBSERVACAO: "border-amber-200 bg-amber-50 text-amber-800",
  NAO_APTO: "border-red-200 bg-red-50 text-red-800",
  CRITICO: "border-red-300 bg-red-100 text-red-900",
};

function FotoItem({ url, label }: { url: string | null; label: string }) {
  if (!url) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        className="max-h-40 w-full rounded-lg border object-cover"
        loading="lazy"
      />
    </div>
  );
}

export function VeiculoSheet({ open, onOpenChange, detalhe, loading, statusPortaria, frotaId }: Props) {
  const [showBloqueioForm, setShowBloqueioForm] = useState(false);
  const [showCorrecaoForm, setShowCorrecaoForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canLiberar = statusPortaria === "LIBERADA_SAIDA";
  const canEntrada = statusPortaria === "SAIDA_REGISTRADA";
  const canBloquear = statusPortaria === "LIBERADA_SAIDA" || statusPortaria === "CHECKLIST_REALIZADO";
  const canCorrecao = statusPortaria === "CHECKLIST_REALIZADO" || statusPortaria === "BLOQUEADA_CHECKLIST";

  const itensCriticos = detalhe?.itens.filter((i) => i.status === "NAO_APTO" && i.critico) ?? [];
  const itensProblema = detalhe?.itens.filter((i) => i.status === "NAO_APTO") ?? [];
  const fotoHodometro = detalhe?.fotos.find((f) => f.source_type === "hodometro");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            {detalhe ? `${detalhe.frota_geral ?? `Frota #${detalhe.frota_id}`} · ${detalhe.placa ?? "—"}` : "Carregando..."}
          </SheetTitle>
        </SheetHeader>

        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        )}

        {!loading && !detalhe && (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Sem checklist de hoje para este veículo.
          </div>
        )}

        {!loading && detalhe && (
          <div className="space-y-5 pb-6">
            {/* Status geral */}
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className={cn("text-sm", STATUS_GERAL_CLASS[detalhe.status_geral ?? ""] ?? "border-slate-200 bg-slate-50")}
              >
                {detalhe.status_geral ?? "—"}
              </Badge>
              {itensCriticos.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                  <XCircle className="h-3.5 w-3.5" />
                  {itensCriticos.length} item(s) crítico(s)
                </span>
              )}
            </div>

            {/* Info veículo + motorista */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-slate-50 p-4">
              <Info icon={<Truck className="h-3.5 w-3.5" />} label="Modelo" value={detalhe.modelo} />
              <Info icon={<User className="h-3.5 w-3.5" />} label="Motorista" value={detalhe.motorista_nome ?? detalhe.motorista_id} />
              <Info icon={<Gauge className="h-3.5 w-3.5" />} label="KM informado" value={formatNumber(detalhe.km_informado)} />
              <Info icon={<Clock className="h-3.5 w-3.5" />} label="Horário" value={detalhe.criado_em ? new Date(detalhe.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"} />
            </div>

            {/* Foto do hodômetro */}
            {fotoHodometro?.signed_url && (
              <FotoItem url={fotoHodometro.signed_url} label="Foto do painel / hodômetro" />
            )}

            {/* Observações */}
            {(detalhe.observacao_corrigida_ia ?? detalhe.observacao_original) && (
              <div className="space-y-1">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <MessageSquare className="h-3 w-3" /> Observações do motorista
                </p>
                <p className="rounded-lg border bg-slate-50 p-3 text-sm">
                  {detalhe.observacao_corrigida_ia ?? detalhe.observacao_original}
                </p>
              </div>
            )}

            {/* Itens com problema */}
            {itensProblema.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-red-600">
                  <AlertTriangle className="h-3 w-3" /> Itens com problema ({itensProblema.length})
                </p>
                <div className="space-y-2">
                  {itensProblema.map((item) => {
                    const foto = detalhe.fotos.find((f) => f.checklist_item_codigo === item.item_codigo);
                    return (
                      <div key={item.id} className={cn("rounded-lg border p-3", item.critico ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50")}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">
                              {item.item_nome}
                              {item.critico && (
                                <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">CRÍTICO</span>
                              )}
                            </p>
                            {item.observacao && (
                              <p className="mt-0.5 text-xs text-muted-foreground">{item.observacao}</p>
                            )}
                          </div>
                          <XCircle className={cn("mt-0.5 h-4 w-4 shrink-0", item.critico ? "text-red-600" : "text-amber-600")} />
                        </div>
                        {foto?.signed_url && (
                          <div className="mt-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={foto.signed_url} alt={item.item_nome} className="max-h-32 w-full rounded-md object-cover" loading="lazy" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Checklist completo (itens OK) */}
            {detalhe.itens.filter((i) => i.status === "APTO").length > 0 && (
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                  Itens aprovados ({detalhe.itens.filter((i) => i.status === "APTO").length})
                </summary>
                <div className="mt-2 space-y-1">
                  {detalhe.itens
                    .filter((i) => i.status === "APTO")
                    .map((item) => (
                      <div key={item.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span className="text-sm">{item.item_nome}</span>
                      </div>
                    ))}
                </div>
              </details>
            )}

            {/* Histórico de ações de hoje */}
            {detalhe.historico_hoje.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Histórico de hoje
                </p>
                <div className="space-y-1.5">
                  {detalhe.historico_hoje.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs">
                      <span className={cn("mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        h.tipo_acao === "SAIDA" ? "bg-blue-100 text-blue-800" :
                        h.tipo_acao === "ENTRADA" ? "bg-emerald-100 text-emerald-800" :
                        h.tipo_acao === "BLOQUEIO" ? "bg-red-100 text-red-800" :
                        "bg-amber-100 text-amber-800"
                      )}>
                        {h.tipo_acao}
                      </span>
                      <div className="min-w-0">
                        {h.motivo_bloqueio && <p className="font-medium">{h.motivo_bloqueio}</p>}
                        <p className="text-muted-foreground">
                          {h.usuario_portaria_id} · {new Date(h.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── AÇÕES ── */}
            <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold">Ações da portaria</p>

              {/* Liberar saída */}
              {canLiberar && (
                <form action={registrarMovimentacaoPortariaAction}>
                  <input type="hidden" name="frota_id" value={detalhe.frota_id} />
                  <input type="hidden" name="checklist_id" value={detalhe.checklist_id} />
                  <input type="hidden" name="tipo_movimentacao" value="SAIDA" />
                  <Button type="submit" className="w-full" disabled={isPending}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Liberar saída
                  </Button>
                </form>
              )}

              {/* Registrar entrada */}
              {canEntrada && (
                <form action={registrarMovimentacaoPortariaAction}>
                  <input type="hidden" name="frota_id" value={detalhe.frota_id} />
                  <input type="hidden" name="checklist_id" value={detalhe.checklist_id} />
                  <input type="hidden" name="tipo_movimentacao" value="ENTRADA" />
                  <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
                    <LogIn className="mr-2 h-4 w-4" />
                    Registrar entrada
                  </Button>
                </form>
              )}

              {/* Bloquear saída */}
              {canBloquear && (
                <>
                  {!showBloqueioForm ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => { setShowBloqueioForm(true); setShowCorrecaoForm(false); }}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Bloquear saída
                    </Button>
                  ) : (
                    <form action={bloquearSaidaAction} className="space-y-2">
                      <input type="hidden" name="frota_id" value={detalhe.frota_id} />
                      <input type="hidden" name="checklist_id" value={detalhe.checklist_id} />
                      <Label htmlFor="motivo_bloqueio" className="text-xs">Motivo do bloqueio (obrigatório)</Label>
                      <textarea
                        id="motivo_bloqueio"
                        name="motivo"
                        rows={2}
                        required
                        placeholder="Ex: Pneu traseiro direito com corte visível..."
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button type="submit" variant="destructive" size="sm" className="flex-1" disabled={isPending}>
                          Confirmar bloqueio
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowBloqueioForm(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  )}
                </>
              )}

              {/* Solicitar correção */}
              {canCorrecao && (
                <>
                  {!showCorrecaoForm ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={() => { setShowCorrecaoForm(true); setShowBloqueioForm(false); }}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Solicitar correção ao motorista
                    </Button>
                  ) : (
                    <form action={solicitarCorrecaoAction} className="space-y-2">
                      <input type="hidden" name="frota_id" value={detalhe.frota_id} />
                      <input type="hidden" name="checklist_id" value={detalhe.checklist_id} />
                      <Label htmlFor="motivo_correcao" className="text-xs">O que precisa ser corrigido</Label>
                      <textarea
                        id="motivo_correcao"
                        name="motivo"
                        rows={2}
                        required
                        placeholder="Ex: Foto do hodômetro ilegível, refazer..."
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button type="submit" variant="outline" size="sm" className="flex-1 border-amber-300 text-amber-800" disabled={isPending}>
                          Enviar solicitação
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowCorrecaoForm(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}
```

- [ ] **Criar `app/(app)/portaria/portaria-actions-client.ts`** (re-exports para usar em Client Component)

```typescript
"use server";
export { registrarMovimentacaoPortariaAction, bloquearSaidaAction, solicitarCorrecaoAction } from "./_actions";
```

- [ ] **Verificar TypeScript**

```bash
cd c:\frotas && npx tsc --noEmit 2>&1 | grep -v ".next/dev"
```

- [ ] **Commit**

```bash
git add app/(app)/portaria/veiculo-sheet.tsx app/(app)/portaria/portaria-actions-client.ts
git commit -m "feat(portaria): VeiculoSheet com checklist completo, fotos, itens e ações"
```

---

## Task 5: Wrapper client para abrir sheet (PortariaClient)

**Arquivos:**
- Criar: `app/(app)/portaria/portaria-client.tsx`

O `page.tsx` é um Server Component. Para adicionar interatividade (clicar abre sheet), crie um Client Component wrapper que recebe os dados via props do server.

- [ ] **Criar `app/(app)/portaria/portaria-client.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  LogIn, LogOut, Search, AlertTriangle, CheckCircle2,
  Clock, Loader2, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatNumber } from "@/lib/utils";
import { VeiculoSheet } from "./veiculo-sheet";
import type { PortariaRow, StatusPortaria } from "@/lib/repos/checklists";
import type { ChecklistDetalhePortaria } from "@/lib/repos/portaria-detail";

// Server Action que busca o detalhe (chamada a partir do client)
async function fetchDetalhe(checklistId: number, frotaId: number): Promise<ChecklistDetalhePortaria | null> {
  const res = await fetch(`/api/portaria/detalhe?checklist_id=${checklistId}&frota_id=${frotaId}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

const STATUS_CLASS: Record<StatusPortaria, string> = {
  PENDENTE_CHECKLIST: "border-slate-200 bg-slate-50 text-slate-700",
  CHECKLIST_REALIZADO: "border-amber-200 bg-amber-50 text-amber-800",
  LIBERADA_SAIDA: "border-emerald-200 bg-emerald-50 text-emerald-800",
  BLOQUEADA_CHECKLIST: "border-red-200 bg-red-50 text-red-800",
  BLOQUEADA_MANUTENCAO: "border-violet-200 bg-violet-50 text-violet-800",
  SAIDA_REGISTRADA: "border-blue-200 bg-blue-50 text-blue-800",
  ENTRADA_REGISTRADA: "border-slate-200 bg-slate-100 text-slate-700",
};

const STATUS_LABELS: Record<StatusPortaria, string> = {
  PENDENTE_CHECKLIST: "Pendente checklist",
  CHECKLIST_REALIZADO: "Com observação",
  LIBERADA_SAIDA: "Liberada",
  BLOQUEADA_CHECKLIST: "Bloqueada",
  BLOQUEADA_MANUTENCAO: "Em manutenção",
  SAIDA_REGISTRADA: "Saída registrada",
  ENTRADA_REGISTRADA: "Entrada registrada",
};

const FILTER_TABS: { label: string; value: StatusPortaria | "TODAS" }[] = [
  { label: "Todas", value: "TODAS" },
  { label: "Aguardando", value: "LIBERADA_SAIDA" },
  { label: "Pendentes", value: "PENDENTE_CHECKLIST" },
  { label: "Bloqueadas", value: "BLOQUEADA_CHECKLIST" },
  { label: "Saídas", value: "SAIDA_REGISTRADA" },
];

type Props = { rows: PortariaRow[]; erro?: string | null };

export function PortariaClient({ rows, erro }: Props) {
  const [query, setQuery] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusPortaria | "TODAS">("TODAS");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<PortariaRow | null>(null);
  const [detalhe, setDetalhe] = useState<ChecklistDetalhePortaria | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (q) {
      const match = [r.frota_geral, r.placa, r.modelo, r.motorista_nome]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filtroStatus !== "TODAS" && r.status_portaria !== filtroStatus) return false;
    return true;
  });

  async function handleRowClick(row: PortariaRow) {
    setSelectedRow(row);
    setSheetOpen(true);
    setDetalhe(null);
    if (row.checklist_id) {
      setLoadingDetalhe(true);
      try {
        const d = await fetchDetalhe(row.checklist_id, row.frota_id);
        setDetalhe(d);
      } finally {
        setLoadingDetalhe(false);
      }
    }
  }

  return (
    <>
      {erro && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {erro}
        </div>
      )}

      {/* Barra de pesquisa + filtros */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por placa, frota ou motorista..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Tabs de filtro */}
        <div className="flex gap-1 overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFiltroStatus(tab.value)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                filtroStatus === tab.value
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {tab.label}
              {tab.value !== "TODAS" && (
                <span className="ml-1 opacity-70">
                  {rows.filter((r) => r.status_portaria === tab.value).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de veículos */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">
            Nenhuma frota encontrada para os filtros selecionados.
          </div>
        )}
        {filtered.map((row) => (
          <button
            key={row.frota_id}
            type="button"
            onClick={() => handleRowClick(row)}
            className="group w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {/* Linha 1: frota + placa + status */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{row.frota_geral ?? `#${row.frota_id}`}</span>
                  {row.placa && <span className="font-mono text-sm text-muted-foreground">{row.placa}</span>}
                  <Badge variant="outline" className={cn("text-xs", STATUS_CLASS[row.status_portaria])}>
                    {STATUS_LABELS[row.status_portaria]}
                  </Badge>
                </div>

                {/* Linha 2: motorista + horário */}
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {row.motorista_nome && (
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                      {row.motorista_nome}
                    </span>
                  )}
                  {row.data_checklist && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(row.data_checklist).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {row.km_informado != null && (
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                      {formatNumber(row.km_informado)} km
                    </span>
                  )}
                </div>

                {/* Linha 3: pendência crítica */}
                {row.pendencia_critica_item && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    {row.pendencia_critica_item}
                  </div>
                )}
              </div>

              {/* Ação rápida ou chevron */}
              <div className="flex shrink-0 items-center gap-2">
                {row.status_portaria === "LIBERADA_SAIDA" && (
                  <span className="rounded-full bg-emerald-100 p-1.5 text-emerald-700">
                    <LogOut className="h-4 w-4" />
                  </span>
                )}
                {row.status_portaria === "SAIDA_REGISTRADA" && (
                  <span className="rounded-full bg-blue-100 p-1.5 text-blue-700">
                    <LogIn className="h-4 w-4" />
                  </span>
                )}
                {row.status_portaria === "BLOQUEADA_CHECKLIST" && (
                  <span className="rounded-full bg-red-100 p-1.5 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Sheet de detalhe */}
      <VeiculoSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        detalhe={detalhe}
        loading={loadingDetalhe}
        statusPortaria={selectedRow?.status_portaria ?? null}
        frotaId={selectedRow?.frota_id ?? null}
      />
    </>
  );
}
```

- [ ] **Verificar TypeScript**

```bash
cd c:\frotas && npx tsc --noEmit 2>&1 | grep -v ".next/dev"
```

- [ ] **Commit**

```bash
git add app/(app)/portaria/portaria-client.tsx
git commit -m "feat(portaria): PortariaClient com lista clicável, filtros por status e sheet"
```

---

## Task 6: API Route para buscar detalhe do checklist

**Arquivos:**
- Criar: `app/api/portaria/detalhe/route.ts`

- [ ] **Criar `app/api/portaria/detalhe/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getChecklistDetalhePortaria } from "@/lib/repos/portaria-detail";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const checklistId = Number(searchParams.get("checklist_id"));
  const frotaId = Number(searchParams.get("frota_id"));

  if (!checklistId || !frotaId) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  try {
    const detalhe = await getChecklistDetalhePortaria(checklistId, frotaId);
    return NextResponse.json(detalhe);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao buscar detalhe.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Commit**

```bash
git add app/api/portaria/detalhe/route.ts
git commit -m "feat(api): GET /api/portaria/detalhe para buscar checklist completo"
```

---

## Task 7: Atualizar page.tsx da portaria

**Arquivos:**
- Modificar: `app/(app)/portaria/page.tsx`

- [ ] **Ler `app/(app)/portaria/page.tsx` completo**

- [ ] **Substituir o conteúdo da página** para usar `PortariaClient` no lugar da tabela atual

O novo `page.tsx` deve:
1. Manter o header, KPIs e título existentes
2. Substituir a tabela/cards + form de movimentação pelo `<PortariaClient rows={rows} erro={sp.erro} />`
3. Remover imports que não são mais usados (LogIn, LogOut, form, MovementAction, etc.)

```tsx
import { requireAppUser } from "@/lib/rbac";
import { listPortariaToday } from "@/lib/repos/checklists";
import { PortariaClient } from "./portaria-client";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortariaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAppUser();
  const sp = await searchParams;
  const rows = await listPortariaToday();

  const kpis = {
    checklistsHoje: rows.filter((r) => r.checklist_id).length,
    liberadas: rows.filter((r) => r.status_portaria === "LIBERADA_SAIDA").length,
    bloqueadas:
      rows.filter((r) => r.status_portaria === "BLOQUEADA_CHECKLIST").length +
      rows.filter((r) => r.status_portaria === "BLOQUEADA_MANUTENCAO").length,
    saidasRegistradas: rows.filter((r) => r.status_portaria === "SAIDA_REGISTRADA").length,
    pendentes: rows.filter((r) => r.status_portaria === "PENDENTE_CHECKLIST").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Portaria</p>
        <h1 className="text-3xl font-semibold tracking-tight">Liberação de frotas</h1>
        <p className="text-sm text-muted-foreground">Hoje: {formatDate(new Date())} · {rows.length} frota(s) ativa(s)</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Checklists hoje", value: kpis.checklistsHoje, color: "text-blue-600" },
          { label: "Liberadas", value: kpis.liberadas, color: "text-emerald-600" },
          { label: "Saídas", value: kpis.saidasRegistradas, color: "text-blue-500" },
          { label: "Bloqueadas", value: kpis.bloqueadas, color: "text-red-600" },
          { label: "Pendentes", value: kpis.pendentes, color: "text-slate-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <p className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <PortariaClient rows={rows} erro={sp.erro} />
    </div>
  );
}
```

- [ ] **Verificar TypeScript**

```bash
cd c:\frotas && npx tsc --noEmit 2>&1 | grep -v ".next/dev"
```

- [ ] **Commit e push**

```bash
git add app/(app)/portaria/page.tsx
git commit -m "feat(portaria): redesign completo — central operacional com sheet e filtros"
git push FROTAS main && git push MANUT main
```

---

## Checklist de spec coverage

| Requisito | Task | Status |
|---|---|---|
| Veículos aguardando liberação na lista | T5 PortariaClient | ✅ |
| Clicar abre detalhes do checklist | T4+T5 Sheet + Client | ✅ |
| Ver itens, pendências, fotos, KM, observações | T2+T4 repo + Sheet | ✅ |
| Itens críticos destacados visualmente | T4 VeiculoSheet | ✅ |
| Botão liberar saída | T4 VeiculoSheet | ✅ |
| Botão bloquear saída com justificativa | T3+T4 actions + Sheet | ✅ |
| Solicitar correção ao motorista | T3+T4 actions + Sheet | ✅ |
| Histórico de ações no sheet | T2+T4 portaria-detail + Sheet | ✅ |
| Filtros por status (tabs) | T5 PortariaClient | ✅ |
| Fotos do hodômetro e itens | T2+T4 signed URLs + Sheet | ✅ |
| Todo ação gera histórico com usuário/data | T1+T3 migration + actions | ✅ |
| Registrar entrada | T4 VeiculoSheet | ✅ |
| Busca por placa/frota/motorista | T5 PortariaClient | ✅ |
