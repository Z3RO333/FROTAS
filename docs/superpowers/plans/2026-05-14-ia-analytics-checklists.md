# IA Analytics — Checklists Intelligence Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar os checklists diários em dados inteligentes: análise automática por IA, classificação de criticidade, alertas operacionais, dashboard de relatórios e envio de relatório diário por e-mail.

**Architecture:** Após o checklist ser salvo, uma chamada fire-and-forget enfileira a análise assíncrona. A IA (OpenAI GPT-4.1-mini) recebe os dados do checklist e retorna JSON estruturado com criticidade, texto corrigido, ações recomendadas e flags de manutenção/bloqueio. Os resultados são persistidos em tabelas dedicadas e exibidos no dashboard existente e em uma nova tela de relatórios.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL), OpenAI SDK (já instalado), Zod, React Server Components, Tailwind CSS, Resend (já usado para e-mail via `email_logs`).

---

## Mapa de Arquivos

| Arquivo | Operação | Responsabilidade |
|---|---|---|
| `supabase/migrations/005_ia_analytics.sql` | Criar | Tabelas: `analises_checklist_ia`, `alertas_frota`, `logs_ia` |
| `lib/ai/checklist-analyzer.ts` | Criar | Chamada OpenAI + schema Zod para análise de checklist |
| `lib/repos/analises-ia.ts` | Criar | CRUD das análises (salvar, buscar por checklist/frota) |
| `lib/repos/alertas.ts` | Criar | CRUD dos alertas (criar, listar, resolver) |
| `lib/repos/relatorios.ts` | Criar | Queries de agregação para o dashboard de relatórios |
| `app/api/checklists/analyze/route.ts` | Criar | POST: analisa um checklist por ID; GET: batch de pendentes |
| `lib/repos/checklists.ts` | Modificar | Fire-and-forget da análise após `createChecklist` |
| `app/(app)/relatorios/checklists/page.tsx` | Criar | Dashboard de inteligência (RSC) |
| `components/relatorios/checklist-ia-kpis.tsx` | Criar | Cards KPI: total dia, OK/atenção/crítico, manutenção/bloqueio |
| `components/relatorios/alertas-ativos.tsx` | Criar | Tabela de alertas abertos com ação de resolver |
| `components/relatorios/ranking-frotas.tsx` | Criar | Top frotas com mais problemas |
| `components/relatorios/checklist-ia-table.tsx` | Criar | Tabela de checklists com colunas de análise IA |
| `app/api/relatorios/daily/route.ts` | Criar | GET protegido por secret: gera e envia relatório diário |
| `components/app-shell.tsx` | Modificar | Adicionar link Relatórios IA no menu ADMIN/GESTOR/DEV |

---

## Fase 1 — Database

### Task 1: Migration das tabelas de analytics

**Files:**
- Create: `supabase/migrations/005_ia_analytics.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/005_ia_analytics.sql

-- Análise IA por checklist
create table if not exists public.analises_checklist_ia (
  id bigserial primary key,
  checklist_id bigint not null references public.checklists_frota(id) on delete cascade,
  frota_id bigint not null references public.veiculos(id) on delete cascade,
  motorista_id text not null,
  data_checklist timestamptz not null,

  -- Textos
  texto_original text,
  texto_corrigido text,

  -- Classificação
  criticidade text not null check (criticidade in ('OK','ATENCAO','CRITICO','MANUTENCAO','BLOQUEIO_SUGERIDO')),
  resumo_ia text,
  justificativa text,
  acao_recomendada text,
  problemas_detectados jsonb not null default '[]'::jsonb,

  -- Flags
  manutencao_sugerida boolean not null default false,
  bloqueio_sugerido boolean not null default false,
  confianca double precision,

  -- Metadados
  modelo_ia text,
  analisado_em timestamptz not null default now(),
  revisado_por text,
  revisado_em timestamptz,
  criticidade_revisada text,
  unique (checklist_id)
);

create index if not exists analises_ia_frota_idx on public.analises_checklist_ia (frota_id, analisado_em desc);
create index if not exists analises_ia_criticidade_idx on public.analises_checklist_ia (criticidade, analisado_em desc);
create index if not exists analises_ia_data_idx on public.analises_checklist_ia (data_checklist desc);

-- Alertas operacionais
create table if not exists public.alertas_frota (
  id bigserial primary key,
  frota_id bigint not null references public.veiculos(id) on delete cascade,
  checklist_id bigint references public.checklists_frota(id) on delete set null,
  analise_id bigint references public.analises_checklist_ia(id) on delete set null,
  tipo text not null check (tipo in ('CRITICO','MANUTENCAO','BLOQUEIO_SUGERIDO','KM_ANOMALO')),
  titulo text not null,
  descricao text,
  status text not null default 'ABERTO' check (status in ('ABERTO','RESOLVIDO','IGNORADO')),
  resolvido_por text,
  resolvido_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists alertas_frota_status_idx on public.alertas_frota (status, criado_em desc);
create index if not exists alertas_frota_frota_idx on public.alertas_frota (frota_id, criado_em desc);

-- Log de chamadas à IA (auditoria)
create table if not exists public.logs_ia (
  id bigserial primary key,
  operacao text not null,
  checklist_id bigint,
  frota_id bigint,
  modelo text,
  tokens_entrada integer,
  tokens_saida integer,
  duracao_ms integer,
  sucesso boolean not null,
  erro_msg text,
  payload_entrada jsonb,
  payload_saida jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists logs_ia_operacao_idx on public.logs_ia (operacao, criado_em desc);
create index if not exists logs_ia_checklist_idx on public.logs_ia (checklist_id);

-- Coluna na checklists_frota para rastrear status da análise
alter table public.checklists_frota
  add column if not exists analise_status text not null default 'PENDENTE'
    check (analise_status in ('PENDENTE','PROCESSANDO','CONCLUIDA','ERRO'));

create index if not exists checklists_analise_status_idx
  on public.checklists_frota (analise_status, criado_em asc)
  where analise_status = 'PENDENTE';
```

- [ ] **Step 2: Aplicar a migration no Supabase**

```bash
npx supabase db push
```

Esperado: "Migrations applied successfully" ou equivalente. Se usar MCP Supabase, usar `apply_migration`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_ia_analytics.sql
git commit -m "feat: migration tabelas analises_checklist_ia, alertas_frota, logs_ia"
```

---

## Fase 2 — IA Core

### Task 2: Schema Zod + chamada OpenAI para análise de checklist

**Files:**
- Create: `lib/ai/checklist-analyzer.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// lib/ai/checklist-analyzer.ts
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const ProblemaSchema = z.object({
  item: z.string(),
  severidade: z.enum(["LEVE", "MODERADA", "GRAVE"]),
  descricao: z.string(),
});

const ChecklistAnalysisSchema = z.object({
  texto_corrigido: z.string().nullable(),
  criticidade: z.enum(["OK", "ATENCAO", "CRITICO", "MANUTENCAO", "BLOQUEIO_SUGERIDO"]),
  resumo: z.string(),
  justificativa: z.string(),
  acao_recomendada: z.string().nullable(),
  manutencao_sugerida: z.boolean(),
  bloqueio_sugerido: z.boolean(),
  confianca: z.number().min(0).max(1),
  problemas_detectados: z.array(ProblemaSchema),
});

export type ChecklistAnalysisResult = z.infer<typeof ChecklistAnalysisSchema>;
export type ChecklistAnalysisInput = {
  checklist_id: number;
  frota_codigo: string | null;
  placa: string | null;
  modelo: string | null;
  km_informado: number | null;
  km_anterior: number | null;
  status_geral: string;
  observacao_original: string | null;
  itens: Array<{
    nome: string;
    grupo: string;
    status: string;
    critico: boolean;
    observacao: string | null;
  }>;
};

export type ChecklistAnalysisOutput = {
  result: ChecklistAnalysisResult | null;
  tokens_entrada: number;
  tokens_saida: number;
  duracao_ms: number;
  modelo: string;
  erro: string | null;
};

const FALLBACK: ChecklistAnalysisResult = {
  texto_corrigido: null,
  criticidade: "OK",
  resumo: "Análise indisponível.",
  justificativa: "IA não disponível no momento.",
  acao_recomendada: null,
  manutencao_sugerida: false,
  bloqueio_sugerido: false,
  confianca: 0,
  problemas_detectados: [],
};

let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  _client ??= new OpenAI({ apiKey: key });
  return _client;
}

const SYSTEM_PROMPT = `Você é um analista de frotas experiente. Analisa checklists de veículos e classifica riscos operacionais.

Classificações de criticidade:
- OK: Sem problemas relevantes. Todos os itens aptos, sem observações preocupantes.
- ATENCAO: Problema leve ou que precisa ser acompanhado (lâmpada queimada, arranhão pequeno, limpeza ruim).
- CRITICO: Problema que afeta segurança ou operação (freio com falha, pneu furado, vazamento de óleo, luz de alerta, superaquecimento).
- MANUTENCAO: Frota com indício claro de necessidade de manutenção preventiva ou corretiva.
- BLOQUEIO_SUGERIDO: Risco alto — veículo não deve circular (falha grave de freio, pneu rasgado, motor com problema grave).

Regras:
1. NUNCA invente problemas.
2. NUNCA remova informação importante do texto original.
3. Preserve o sentido original ao corrigir o texto.
4. A justificativa deve ser curta (1-2 frases).
5. Se não houver observação escrita, texto_corrigido deve ser null.
6. Responda APENAS com o JSON do schema.`;

export async function analyzeChecklist(
  input: ChecklistAnalysisInput
): Promise<ChecklistAnalysisOutput> {
  const client = getClient();
  const modelo = process.env.OPENAI_CHECKLIST_MODEL ?? "gpt-4.1-mini";
  const inicio = Date.now();

  if (!client) {
    return { result: FALLBACK, tokens_entrada: 0, tokens_saida: 0, duracao_ms: 0, modelo, erro: "OPENAI_API_KEY não configurada" };
  }

  const itensNaoAptos = input.itens.filter((i) => i.status === "NAO_APTO");
  const userContent = `
Frota: ${input.frota_codigo ?? "—"} | Placa: ${input.placa ?? "—"} | Modelo: ${input.modelo ?? "—"}
KM atual: ${input.km_informado ?? "—"} | KM anterior: ${input.km_anterior ?? "—"}
Status geral: ${input.status_geral}

Itens NÃO APTOS (${itensNaoAptos.length}):
${itensNaoAptos.map((i) => `- [${i.critico ? "CRÍTICO" : "normal"}] ${i.nome} (${i.grupo})${i.observacao ? `: "${i.observacao}"` : ""}`).join("\n") || "Nenhum"}

Observação geral do motorista:
"${input.observacao_original ?? ""}"

Analise e classifique.`.trim();

  try {
    const response = await client.responses.parse({
      model: modelo,
      input: [
        { role: "developer", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      text: { format: zodTextFormat(ChecklistAnalysisSchema, "checklist_analysis") },
    });

    const result = response.output_parsed;
    if (!result) {
      return { result: FALLBACK, tokens_entrada: 0, tokens_saida: 0, duracao_ms: Date.now() - inicio, modelo, erro: "Resposta vazia da IA" };
    }

    return {
      result,
      tokens_entrada: response.usage?.input_tokens ?? 0,
      tokens_saida: response.usage?.output_tokens ?? 0,
      duracao_ms: Date.now() - inicio,
      modelo,
      erro: null,
    };
  } catch (err) {
    return {
      result: FALLBACK,
      tokens_entrada: 0,
      tokens_saida: 0,
      duracao_ms: Date.now() - inicio,
      modelo,
      erro: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/checklist-analyzer.ts
git commit -m "feat: checklist-analyzer — schema Zod + chamada OpenAI"
```

---

### Task 3: Repositório de análises IA + alertas

**Files:**
- Create: `lib/repos/analises-ia.ts`
- Create: `lib/repos/alertas.ts`

- [ ] **Step 1: Criar `lib/repos/analises-ia.ts`**

```typescript
// lib/repos/analises-ia.ts
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { ChecklistAnalysisResult } from "@/lib/ai/checklist-analyzer";

export type AnaliseIaRow = {
  id: number;
  checklist_id: number;
  frota_id: number;
  motorista_id: string;
  data_checklist: string;
  texto_original: string | null;
  texto_corrigido: string | null;
  criticidade: "OK" | "ATENCAO" | "CRITICO" | "MANUTENCAO" | "BLOQUEIO_SUGERIDO";
  resumo_ia: string | null;
  justificativa: string | null;
  acao_recomendada: string | null;
  problemas_detectados: Array<{ item: string; severidade: string; descricao: string }>;
  manutencao_sugerida: boolean;
  bloqueio_sugerido: boolean;
  confianca: number | null;
  modelo_ia: string | null;
  analisado_em: string;
  revisado_por: string | null;
  revisado_em: string | null;
  criticidade_revisada: string | null;
};

export type SaveAnaliseInput = {
  checklist_id: number;
  frota_id: number;
  motorista_id: string;
  data_checklist: string;
  texto_original: string | null;
  result: ChecklistAnalysisResult;
  modelo_ia: string;
};

export async function saveAnaliseIa(input: SaveAnaliseInput): Promise<number> {
  const { data, error } = await supabaseManutencao
    .from("analises_checklist_ia")
    .upsert(
      {
        checklist_id: input.checklist_id,
        frota_id: input.frota_id,
        motorista_id: input.motorista_id,
        data_checklist: input.data_checklist,
        texto_original: input.texto_original,
        texto_corrigido: input.result.texto_corrigido,
        criticidade: input.result.criticidade,
        resumo_ia: input.result.resumo,
        justificativa: input.result.justificativa,
        acao_recomendada: input.result.acao_recomendada,
        problemas_detectados: input.result.problemas_detectados,
        manutencao_sugerida: input.result.manutencao_sugerida,
        bloqueio_sugerido: input.result.bloqueio_sugerido,
        confianca: input.result.confianca,
        modelo_ia: input.modelo_ia,
        analisado_em: new Date().toISOString(),
      },
      { onConflict: "checklist_id" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return Number(data.id);
}

export async function getAnaliseByChecklist(checklistId: number): Promise<AnaliseIaRow | null> {
  const { data, error } = await supabaseManutencao
    .from("analises_checklist_ia")
    .select("*")
    .eq("checklist_id", checklistId)
    .maybeSingle();
  if (error) throw error;
  return (data as AnaliseIaRow) ?? null;
}

export async function listAnalisesDia(date: string): Promise<AnaliseIaRow[]> {
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const { data, error } = await supabaseManutencao
    .from("analises_checklist_ia")
    .select("*")
    .gte("data_checklist", start)
    .lte("data_checklist", end)
    .order("analisado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AnaliseIaRow[];
}

export async function listChecklistsPendentesAnalise(limit = 50): Promise<
  Array<{ id: number; frota_id: number; motorista_id: string; data_checklist: string; observacao_original: string | null; km_informado: number | null }>
> {
  const { data, error } = await supabaseManutencao
    .from("checklists_frota")
    .select("id,frota_id,motorista_id,data_checklist,observacao_original,km_informado")
    .eq("analise_status", "PENDENTE")
    .order("criado_em", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function setAnaliseStatus(
  checklistId: number,
  status: "PENDENTE" | "PROCESSANDO" | "CONCLUIDA" | "ERRO"
): Promise<void> {
  const { error } = await supabaseManutencao
    .from("checklists_frota")
    .update({ analise_status: status })
    .eq("id", checklistId);
  if (error) throw error;
}

export async function saveLogIa(input: {
  operacao: string;
  checklist_id: number | null;
  frota_id: number | null;
  modelo: string;
  tokens_entrada: number;
  tokens_saida: number;
  duracao_ms: number;
  sucesso: boolean;
  erro_msg: string | null;
  payload_entrada: object;
  payload_saida: object | null;
}): Promise<void> {
  await supabaseManutencao.from("logs_ia").insert(input).then(({ error }) => {
    if (error) console.warn("[logs_ia] falha ao salvar log", error);
  });
}

export async function revisarAnalise(
  analiseId: number,
  revisadoPor: string,
  criticidadeRevisada: string
): Promise<void> {
  const { error } = await supabaseManutencao
    .from("analises_checklist_ia")
    .update({
      revisado_por: revisadoPor,
      revisado_em: new Date().toISOString(),
      criticidade_revisada: criticidadeRevisada,
    })
    .eq("id", analiseId);
  if (error) throw error;
}
```

- [ ] **Step 2: Criar `lib/repos/alertas.ts`**

```typescript
// lib/repos/alertas.ts
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type AlertaRow = {
  id: number;
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  checklist_id: number | null;
  analise_id: number | null;
  tipo: "CRITICO" | "MANUTENCAO" | "BLOQUEIO_SUGERIDO" | "KM_ANOMALO";
  titulo: string;
  descricao: string | null;
  status: "ABERTO" | "RESOLVIDO" | "IGNORADO";
  resolvido_por: string | null;
  resolvido_em: string | null;
  criado_em: string;
};

type AlertaDbRow = Omit<AlertaRow, "frota_geral" | "placa">;

export async function createAlerta(input: {
  frota_id: number;
  checklist_id: number | null;
  analise_id: number | null;
  tipo: AlertaRow["tipo"];
  titulo: string;
  descricao: string | null;
}): Promise<number> {
  const { data, error } = await supabaseManutencao
    .from("alertas_frota")
    .insert({
      frota_id: input.frota_id,
      checklist_id: input.checklist_id,
      analise_id: input.analise_id,
      tipo: input.tipo,
      titulo: input.titulo,
      descricao: input.descricao,
      status: "ABERTO",
    })
    .select("id")
    .single();
  if (error) throw error;
  return Number(data.id);
}

export async function listAlertasAbertos(limit = 50): Promise<AlertaRow[]> {
  const { data, error } = await supabaseManutencao
    .from("alertas_frota")
    .select("*")
    .eq("status", "ABERTO")
    .order("criado_em", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as AlertaDbRow[];
  const frotaIds = [...new Set(rows.map((r) => r.frota_id))];

  if (frotaIds.length === 0) return [];

  const { data: veiculos } = await supabaseManutencao
    .from("veiculos")
    .select("id,codigo_frota,placa")
    .in("id", frotaIds);

  const veiculoMap = new Map(
    (veiculos ?? []).map((v) => [Number(v.id), v as { id: number; codigo_frota: string | null; placa: string | null }])
  );

  return rows.map((row) => ({
    ...row,
    frota_geral: veiculoMap.get(row.frota_id)?.codigo_frota ?? null,
    placa: veiculoMap.get(row.frota_id)?.placa ?? null,
  }));
}

export async function resolverAlerta(
  alertaId: number,
  resolvidoPor: string,
  novoStatus: "RESOLVIDO" | "IGNORADO"
): Promise<void> {
  const { error } = await supabaseManutencao
    .from("alertas_frota")
    .update({ status: novoStatus, resolvido_por: resolvidoPor, resolvido_em: new Date().toISOString() })
    .eq("id", alertaId);
  if (error) throw error;
}

export async function countAlertasAbertos(): Promise<number> {
  const { count, error } = await supabaseManutencao
    .from("alertas_frota")
    .select("id", { count: "exact", head: true })
    .eq("status", "ABERTO");
  if (error) return 0;
  return count ?? 0;
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add lib/repos/analises-ia.ts lib/repos/alertas.ts
git commit -m "feat: repos analises-ia e alertas — CRUD Supabase"
```

---

### Task 4: API Route de análise (trigger manual + batch)

**Files:**
- Create: `app/api/checklists/analyze/route.ts`

- [ ] **Step 1: Criar a route**

```typescript
// app/api/checklists/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeChecklist } from "@/lib/ai/checklist-analyzer";
import { listChecklistItems } from "@/lib/repos/checklists";
import {
  getAnaliseByChecklist,
  listChecklistsPendentesAnalise,
  saveAnaliseIa,
  saveLogIa,
  setAnaliseStatus,
} from "@/lib/repos/analises-ia";
import { createAlerta } from "@/lib/repos/alertas";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

const INTERNAL_SECRET = process.env.FROTAS_INTERNAL_SECRET ?? "";

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("x-internal-secret");
  return Boolean(INTERNAL_SECRET && header === INTERNAL_SECRET);
}

// GET /api/checklists/analyze — processa batch de pendentes (chamado por cron ou admin)
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pendentes = await listChecklistsPendentesAnalise(20);
  const results: Array<{ checklist_id: number; status: string }> = [];

  for (const checklist of pendentes) {
    const res = await processarChecklist(checklist.id, false);
    results.push({ checklist_id: checklist.id, status: res });
  }

  return NextResponse.json({ processados: results.length, results });
}

// POST /api/checklists/analyze — analisa um checklist específico
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ checklist_id: z.number().int().positive() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "checklist_id inválido" }, { status: 400 });

  const status = await processarChecklist(parsed.data.checklist_id, true);
  return NextResponse.json({ checklist_id: parsed.data.checklist_id, status });
}

async function processarChecklist(checklistId: number, forcar: boolean): Promise<string> {
  if (!forcar) {
    const existente = await getAnaliseByChecklist(checklistId).catch(() => null);
    if (existente) return "ja_analisado";
  }

  await setAnaliseStatus(checklistId, "PROCESSANDO");

  try {
    const { data: checklistRows } = await supabaseManutencao
      .from("checklists_frota")
      .select("id,frota_id,motorista_id,data_checklist,observacao_original,km_informado,status_geral")
      .eq("id", checklistId)
      .single();

    if (!checklistRows) {
      await setAnaliseStatus(checklistId, "ERRO");
      return "nao_encontrado";
    }

    const cl = checklistRows as {
      id: number; frota_id: number; motorista_id: string; data_checklist: string;
      observacao_original: string | null; km_informado: number | null; status_geral: string;
    };

    const [itens, { data: veiculo }, { data: kmAnterior }] = await Promise.all([
      listChecklistItems(checklistId),
      supabaseManutencao.from("veiculos").select("codigo_frota,placa,modelo,km_atual").eq("id", cl.frota_id).single(),
      supabaseManutencao
        .from("historico_km_frota")
        .select("km_anterior")
        .eq("frota_id", cl.frota_id)
        .eq("checklist_id", checklistId)
        .maybeSingle(),
    ]);

    const v = veiculo as { codigo_frota: string | null; placa: string | null; modelo: string | null; km_atual: number | null } | null;

    const output = await analyzeChecklist({
      checklist_id: checklistId,
      frota_codigo: v?.codigo_frota ?? null,
      placa: v?.placa ?? null,
      modelo: v?.modelo ?? null,
      km_informado: cl.km_informado,
      km_anterior: (kmAnterior as { km_anterior: number | null } | null)?.km_anterior ?? null,
      status_geral: cl.status_geral,
      observacao_original: cl.observacao_original,
      itens: itens.map((i) => ({
        nome: i.item_nome,
        grupo: i.grupo,
        status: i.status,
        critico: i.critico,
        observacao: i.observacao,
      })),
    });

    await saveLogIa({
      operacao: "analise_checklist",
      checklist_id: checklistId,
      frota_id: cl.frota_id,
      modelo: output.modelo,
      tokens_entrada: output.tokens_entrada,
      tokens_saida: output.tokens_saida,
      duracao_ms: output.duracao_ms,
      sucesso: output.erro === null,
      erro_msg: output.erro,
      payload_entrada: { checklist_id: checklistId },
      payload_saida: output.result,
    });

    if (!output.result) {
      await setAnaliseStatus(checklistId, "ERRO");
      return "erro_ia";
    }

    const analiseId = await saveAnaliseIa({
      checklist_id: checklistId,
      frota_id: cl.frota_id,
      motorista_id: cl.motorista_id,
      data_checklist: cl.data_checklist,
      texto_original: cl.observacao_original,
      result: output.result,
      modelo_ia: output.modelo,
    });

    if (output.result.criticidade === "CRITICO" || output.result.criticidade === "BLOQUEIO_SUGERIDO" || output.result.manutencao_sugerida) {
      const tipo = output.result.bloqueio_sugerido
        ? "BLOQUEIO_SUGERIDO"
        : output.result.manutencao_sugerida
          ? "MANUTENCAO"
          : "CRITICO";

      await createAlerta({
        frota_id: cl.frota_id,
        checklist_id: checklistId,
        analise_id: analiseId,
        tipo,
        titulo: `${tipo.replace("_", " ")} — Frota ${v?.codigo_frota ?? cl.frota_id}`,
        descricao: output.result.resumo,
      }).catch((err) => console.warn("[alertas] falha ao criar alerta", err));
    }

    await setAnaliseStatus(checklistId, "CONCLUIDA");
    return "ok";
  } catch (err) {
    await setAnaliseStatus(checklistId, "ERRO").catch(() => null);
    console.error("[analyze] erro ao processar checklist", checklistId, err);
    return "erro";
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/api/checklists/analyze/route.ts
git commit -m "feat: API route /api/checklists/analyze — batch e trigger manual"
```

---

### Task 5: Integrar análise assíncrona no createChecklist

**Files:**
- Modify: `lib/repos/checklists.ts` (função `createChecklist`, ~linha 473)

- [ ] **Step 1: Adicionar fire-and-forget após `createChecklist`**

No final da função `createChecklist`, antes do `return`, adicionar:

```typescript
// Fire-and-forget — não bloqueia o salvamento do checklist
const internalSecret = process.env.FROTAS_INTERNAL_SECRET;
if (internalSecret) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  fetch(`${baseUrl}/api/checklists/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret,
    },
    body: JSON.stringify({ checklist_id: checklistId }),
  }).catch((err) => console.warn("[analyze] falha ao disparar análise assíncrona", err));
}
```

Inserir **antes** do `return { checklist_id: ...}` no final da função.

- [ ] **Step 2: Adicionar variáveis ao `.env.local`**

```bash
# .env.local
FROTAS_INTERNAL_SECRET=frotas-internal-secret-dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENAI_CHECKLIST_MODEL=gpt-4.1-mini
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add lib/repos/checklists.ts .env.local
git commit -m "feat: fire-and-forget de análise IA após salvar checklist"
```

---

## Fase 3 — Dashboard de Inteligência

### Task 6: Repositório de relatórios (queries de agregação)

**Files:**
- Create: `lib/repos/relatorios.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// lib/repos/relatorios.ts
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type RelatorioKpis = {
  total_checklists: number;
  ok: number;
  atencao: number;
  critico: number;
  manutencao: number;
  bloqueio_sugerido: number;
  pendentes_analise: number;
  alertas_abertos: number;
};

export type FrotaProblema = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  total_problemas: number;
  ultima_criticidade: string;
};

export type MotoristaRanking = {
  motorista_id: string;
  motorista_nome: string | null;
  total_checklists: number;
};

export type EvolucaoDiaria = {
  data: string;
  total: number;
  ok: number;
  atencao: number;
  critico: number;
};

export async function getRelatorioKpis(date: string): Promise<RelatorioKpis> {
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;

  const [analises, pendentes, alertas] = await Promise.all([
    supabaseManutencao
      .from("analises_checklist_ia")
      .select("criticidade")
      .gte("data_checklist", start)
      .lte("data_checklist", end),
    supabaseManutencao
      .from("checklists_frota")
      .select("id", { count: "exact", head: true })
      .eq("analise_status", "PENDENTE")
      .gte("data_checklist", start)
      .lte("data_checklist", end),
    supabaseManutencao
      .from("alertas_frota")
      .select("id", { count: "exact", head: true })
      .eq("status", "ABERTO"),
  ]);

  const rows = (analises.data ?? []) as Array<{ criticidade: string }>;

  return {
    total_checklists: rows.length,
    ok: rows.filter((r) => r.criticidade === "OK").length,
    atencao: rows.filter((r) => r.criticidade === "ATENCAO").length,
    critico: rows.filter((r) => r.criticidade === "CRITICO").length,
    manutencao: rows.filter((r) => r.criticidade === "MANUTENCAO").length,
    bloqueio_sugerido: rows.filter((r) => r.criticidade === "BLOQUEIO_SUGERIDO").length,
    pendentes_analise: pendentes.count ?? 0,
    alertas_abertos: alertas.count ?? 0,
  };
}

export async function getRankingFrotas(date: string, limit = 10): Promise<FrotaProblema[]> {
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;

  const { data, error } = await supabaseManutencao
    .from("analises_checklist_ia")
    .select("frota_id,criticidade,problemas_detectados")
    .gte("data_checklist", start)
    .lte("data_checklist", end)
    .in("criticidade", ["ATENCAO", "CRITICO", "MANUTENCAO", "BLOQUEIO_SUGERIDO"]);

  if (error) return [];

  const frotaMap = new Map<number, { total: number; criticidade: string }>();
  for (const row of data ?? []) {
    const r = row as { frota_id: number; criticidade: string; problemas_detectados: unknown[] };
    const existing = frotaMap.get(r.frota_id) ?? { total: 0, criticidade: "OK" };
    frotaMap.set(r.frota_id, {
      total: existing.total + (Array.isArray(r.problemas_detectados) ? r.problemas_detectados.length : 0),
      criticidade: r.criticidade,
    });
  }

  const frotaIds = [...frotaMap.keys()];
  if (frotaIds.length === 0) return [];

  const { data: veiculos } = await supabaseManutencao
    .from("veiculos")
    .select("id,codigo_frota,placa")
    .in("id", frotaIds);

  const veiculoMap = new Map(
    (veiculos ?? []).map((v) => [Number(v.id), v as { id: number; codigo_frota: string | null; placa: string | null }])
  );

  return [...frotaMap.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([frota_id, info]) => ({
      frota_id,
      frota_geral: veiculoMap.get(frota_id)?.codigo_frota ?? null,
      placa: veiculoMap.get(frota_id)?.placa ?? null,
      total_problemas: info.total,
      ultima_criticidade: info.criticidade,
    }));
}

export async function getRankingMotoristas(date: string, limit = 10): Promise<MotoristaRanking[]> {
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;

  const { data, error } = await supabaseManutencao
    .from("checklists_frota")
    .select("motorista_id,motorista_nome")
    .gte("data_checklist", start)
    .lte("data_checklist", end);

  if (error) return [];

  const map = new Map<string, { nome: string | null; total: number }>();
  for (const row of (data ?? []) as Array<{ motorista_id: string; motorista_nome: string | null }>) {
    const existing = map.get(row.motorista_id) ?? { nome: row.motorista_nome, total: 0 };
    map.set(row.motorista_id, { ...existing, total: existing.total + 1 });
  }

  return [...map.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([motorista_id, info]) => ({
      motorista_id,
      motorista_nome: info.nome,
      total_checklists: info.total,
    }));
}

export async function getEvolucao7Dias(): Promise<EvolucaoDiaria[]> {
  const dias: EvolucaoDiaria[] = [];
  const hoje = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const kpis = await getRelatorioKpis(dateStr);
    dias.push({
      data: dateStr,
      total: kpis.total_checklists,
      ok: kpis.ok,
      atencao: kpis.atencao,
      critico: kpis.critico,
    });
  }

  return dias;
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/repos/relatorios.ts
git commit -m "feat: repo relatorios — queries de KPI e rankings"
```

---

### Task 7: Componentes do dashboard de inteligência

**Files:**
- Create: `components/relatorios/checklist-ia-kpis.tsx`
- Create: `components/relatorios/alertas-ativos.tsx`
- Create: `components/relatorios/ranking-frotas.tsx`
- Create: `components/relatorios/checklist-ia-table.tsx`

- [ ] **Step 1: Criar `components/relatorios/checklist-ia-kpis.tsx`**

```tsx
// components/relatorios/checklist-ia-kpis.tsx
import type { RelatorioKpis } from "@/lib/repos/relatorios";

const CRITICIDADE_COLORS = {
  ok: "bg-emerald-50 border-emerald-200 text-emerald-800",
  atencao: "bg-amber-50 border-amber-200 text-amber-800",
  critico: "bg-red-50 border-red-200 text-red-800",
  manutencao: "bg-orange-50 border-orange-200 text-orange-800",
  bloqueio_sugerido: "bg-red-100 border-red-300 text-red-900",
};

export function ChecklistIaKpis({ kpis }: { kpis: RelatorioKpis }) {
  const cards = [
    { label: "Total do dia", value: kpis.total_checklists, color: "bg-blue-50 border-blue-200 text-blue-800" },
    { label: "OK", value: kpis.ok, color: CRITICIDADE_COLORS.ok },
    { label: "Atenção", value: kpis.atencao, color: CRITICIDADE_COLORS.atencao },
    { label: "Crítico", value: kpis.critico, color: CRITICIDADE_COLORS.critico },
    { label: "Manutenção", value: kpis.manutencao, color: CRITICIDADE_COLORS.manutencao },
    { label: "Bloqueio sugerido", value: kpis.bloqueio_sugerido, color: CRITICIDADE_COLORS.bloqueio_sugerido },
    { label: "Alertas abertos", value: kpis.alertas_abertos, color: "bg-slate-50 border-slate-200 text-slate-800" },
    { label: "Pendentes análise", value: kpis.pendentes_analise, color: "bg-slate-50 border-slate-200 text-slate-700" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-md border p-3 ${card.color}`}>
          <div className="text-2xl font-bold">{card.value}</div>
          <div className="mt-0.5 text-xs font-medium">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Criar `components/relatorios/alertas-ativos.tsx`**

```tsx
// components/relatorios/alertas-ativos.tsx
import type { AlertaRow } from "@/lib/repos/alertas";
import { resolverAlertaAction } from "@/app/(app)/relatorios/checklists/_actions";

const TIPO_BADGE: Record<string, string> = {
  CRITICO: "bg-red-100 text-red-800",
  MANUTENCAO: "bg-orange-100 text-orange-800",
  BLOQUEIO_SUGERIDO: "bg-red-200 text-red-900",
  KM_ANOMALO: "bg-amber-100 text-amber-800",
};

export function AlertasAtivos({ alertas }: { alertas: AlertaRow[] }) {
  if (alertas.length === 0) {
    return (
      <div className="rounded-md border bg-emerald-50 p-4 text-sm text-emerald-800">
        Nenhum alerta aberto no momento.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-white">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Alertas abertos ({alertas.length})</h2>
      </div>
      <div className="divide-y">
        {alertas.map((alerta) => (
          <div key={alerta.id} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${TIPO_BADGE[alerta.tipo] ?? "bg-slate-100 text-slate-700"}`}>
                  {alerta.tipo.replace("_", " ")}
                </span>
                <span className="text-sm font-medium">{alerta.titulo}</span>
              </div>
              {alerta.descricao && <p className="text-xs text-muted-foreground">{alerta.descricao}</p>}
              <p className="text-xs text-muted-foreground">
                Frota {alerta.frota_geral ?? alerta.frota_id} · {alerta.placa ?? "—"} ·{" "}
                {new Date(alerta.criado_em).toLocaleString("pt-BR")}
              </p>
            </div>
            <form action={resolverAlertaAction}>
              <input type="hidden" name="alerta_id" value={alerta.id} />
              <input type="hidden" name="status" value="RESOLVIDO" />
              <button type="submit" className="shrink-0 rounded border px-3 py-1 text-xs hover:bg-slate-50">
                Resolver
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `components/relatorios/ranking-frotas.tsx`**

```tsx
// components/relatorios/ranking-frotas.tsx
import type { FrotaProblema } from "@/lib/repos/relatorios";
import Link from "next/link";

const COR: Record<string, string> = {
  CRITICO: "text-red-600",
  BLOQUEIO_SUGERIDO: "text-red-700 font-bold",
  MANUTENCAO: "text-orange-600",
  ATENCAO: "text-amber-600",
};

export function RankingFrotas({ frotas }: { frotas: FrotaProblema[] }) {
  if (frotas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma frota com problemas detectados hoje.</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border bg-white">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Frotas com mais problemas (hoje)</h2>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="p-3 text-left">#</th>
            <th className="p-3 text-left">Frota</th>
            <th className="p-3 text-left">Placa</th>
            <th className="p-3 text-right">Problemas</th>
            <th className="p-3 text-left">Criticidade</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {frotas.map((frota, i) => (
            <tr key={frota.frota_id} className="hover:bg-slate-50">
              <td className="p-3 text-muted-foreground">{i + 1}</td>
              <td className="p-3 font-medium">
                <Link href={`/frotas/${frota.frota_id}`} className="hover:text-blue-600">
                  {frota.frota_geral ?? `#${frota.frota_id}`}
                </Link>
              </td>
              <td className="p-3">{frota.placa ?? "—"}</td>
              <td className="p-3 text-right font-semibold">{frota.total_problemas}</td>
              <td className={`p-3 text-xs font-semibold ${COR[frota.ultima_criticidade] ?? "text-slate-600"}`}>
                {frota.ultima_criticidade.replace("_", " ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Criar `components/relatorios/checklist-ia-table.tsx`**

```tsx
// components/relatorios/checklist-ia-table.tsx
import type { AnaliseIaRow } from "@/lib/repos/analises-ia";
import Link from "next/link";

const BADGE: Record<string, string> = {
  OK: "bg-emerald-100 text-emerald-800",
  ATENCAO: "bg-amber-100 text-amber-800",
  CRITICO: "bg-red-100 text-red-800",
  MANUTENCAO: "bg-orange-100 text-orange-800",
  BLOQUEIO_SUGERIDO: "bg-red-200 text-red-900 font-bold",
};

export function ChecklistIaTable({ analises }: { analises: AnaliseIaRow[] }) {
  if (analises.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma análise encontrada.</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="p-3 text-left">Checklist</th>
            <th className="p-3 text-left">Frota</th>
            <th className="p-3 text-left">Motorista</th>
            <th className="p-3 text-left">Criticidade</th>
            <th className="p-3 text-left">Resumo IA</th>
            <th className="p-3 text-left">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {analises.map((analise) => (
            <tr key={analise.id} className="hover:bg-slate-50">
              <td className="p-3">
                <Link href={`/checklists/${analise.checklist_id}`} className="text-blue-600 hover:underline">
                  #{analise.checklist_id}
                </Link>
              </td>
              <td className="p-3">{analise.frota_id}</td>
              <td className="p-3 text-xs">{analise.motorista_id.split("@")[0]}</td>
              <td className="p-3">
                <span className={`rounded px-2 py-0.5 text-xs ${BADGE[analise.criticidade_revisada ?? analise.criticidade] ?? "bg-slate-100 text-slate-700"}`}>
                  {(analise.criticidade_revisada ?? analise.criticidade).replace("_", " ")}
                </span>
              </td>
              <td className="max-w-xs p-3 text-xs text-muted-foreground truncate">{analise.resumo_ia}</td>
              <td className="p-3 text-xs">{analise.acao_recomendada ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add components/relatorios/
git commit -m "feat: componentes do dashboard de inteligência IA"
```

---

### Task 8: Server Action para resolver alertas + página do dashboard

**Files:**
- Create: `app/(app)/relatorios/checklists/_actions.ts`
- Create: `app/(app)/relatorios/checklists/page.tsx`
- Modify: `components/app-shell.tsx`

- [ ] **Step 1: Criar `app/(app)/relatorios/checklists/_actions.ts`**

```typescript
// app/(app)/relatorios/checklists/_actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolverAlerta } from "@/lib/repos/alertas";
import { revisarAnalise } from "@/lib/repos/analises-ia";
import { requireAdminUser } from "@/lib/rbac";

export async function resolverAlertaAction(formData: FormData) {
  const user = await requireAdminUser();
  const alertaId = z.coerce.number().int().positive().parse(formData.get("alerta_id"));
  const status = z.enum(["RESOLVIDO", "IGNORADO"]).parse(formData.get("status"));
  await resolverAlerta(alertaId, user.email, status);
  revalidatePath("/relatorios/checklists");
}

export async function revisarAnaliseAction(formData: FormData) {
  const user = await requireAdminUser();
  const analiseId = z.coerce.number().int().positive().parse(formData.get("analise_id"));
  const criticidade = z.enum(["OK", "ATENCAO", "CRITICO", "MANUTENCAO", "BLOQUEIO_SUGERIDO"]).parse(
    formData.get("criticidade")
  );
  await revisarAnalise(analiseId, user.email, criticidade);
  revalidatePath("/relatorios/checklists");
}
```

- [ ] **Step 2: Criar `app/(app)/relatorios/checklists/page.tsx`**

```tsx
// app/(app)/relatorios/checklists/page.tsx
import { redirect } from "next/navigation";
import { requireAppUser, canAccessAdmin } from "@/lib/rbac";
import { getRelatorioKpis, getRankingFrotas, getRankingMotoristas } from "@/lib/repos/relatorios";
import { listAlertasAbertos } from "@/lib/repos/alertas";
import { listAnalisesDia } from "@/lib/repos/analises-ia";
import { ChecklistIaKpis } from "@/components/relatorios/checklist-ia-kpis";
import { AlertasAtivos } from "@/components/relatorios/alertas-ativos";
import { RankingFrotas } from "@/components/relatorios/ranking-frotas";
import { ChecklistIaTable } from "@/components/relatorios/checklist-ia-table";

export const dynamic = "force-dynamic";

export default async function RelatoriosChecklistPage() {
  const user = await requireAppUser();
  if (!canAccessAdmin(user.perfil)) redirect("/motorista");

  const hoje = new Date().toISOString().slice(0, 10);

  const [kpis, alertas, rankingFrotas, rankingMotoristas, analises] = await Promise.all([
    getRelatorioKpis(hoje),
    listAlertasAbertos(20),
    getRankingFrotas(hoje),
    getRankingMotoristas(hoje),
    listAnalisesDia(hoje),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Inteligência Operacional</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Análise de Checklists — IA</h1>
        <p className="text-sm text-muted-foreground">
          Resultados de hoje ({new Date().toLocaleDateString("pt-BR")})
        </p>
      </div>

      <ChecklistIaKpis kpis={kpis} />

      <AlertasAtivos alertas={alertas} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RankingFrotas frotas={rankingFrotas} />
        <div className="overflow-hidden rounded-md border bg-white">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Ranking de motoristas (hoje)</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3 text-left">#</th>
                <th className="p-3 text-left">Motorista</th>
                <th className="p-3 text-right">Checklists</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rankingMotoristas.map((m, i) => (
                <tr key={m.motorista_id} className="hover:bg-slate-50">
                  <td className="p-3 text-muted-foreground">{i + 1}</td>
                  <td className="p-3">
                    <div className="font-medium">{m.motorista_nome ?? m.motorista_id}</div>
                    <div className="text-xs text-muted-foreground">{m.motorista_id}</div>
                  </td>
                  <td className="p-3 text-right font-semibold">{m.total_checklists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Análises de hoje ({analises.length})</h2>
        </div>
        <ChecklistIaTable analises={analises} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Adicionar link no menu do app-shell**

Em `components/app-shell.tsx`, adicionar ao array `CHECKLIST_NAV`:

```typescript
// Linha existente após { href: "/checklists/validacao-km", label: "Validar KM", icon: Gauge }:
{ href: "/relatorios/checklists", label: "Relatórios IA", icon: LayoutDashboard },
```

Também importar `BarChart2` ou reusar `LayoutDashboard` do lucide-react já importado.

- [ ] **Step 4: Verificar TypeScript + build**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/relatorios/ components/app-shell.tsx
git commit -m "feat: dashboard de inteligência IA — KPIs, alertas, rankings"
```

---

## Fase 4 — Relatório Diário por E-mail

### Task 9: Route de relatório diário

**Files:**
- Create: `app/api/relatorios/daily/route.ts`

- [ ] **Step 1: Verificar como e-mail já é enviado no projeto**

```bash
grep -r "email\|Resend\|nodemailer\|sendEmail" lib/ --include="*.ts" -l
```

Confirmar qual lib de e-mail é usada. Se for Resend (`email_logs` sugere isso), a route vai usar o padrão já existente.

- [ ] **Step 2: Criar a route**

```typescript
// app/api/relatorios/daily/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRelatorioKpis, getRankingFrotas } from "@/lib/repos/relatorios";
import { listAlertasAbertos } from "@/lib/repos/alertas";
import { listAnalisesDia } from "@/lib/repos/analises-ia";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

const INTERNAL_SECRET = process.env.FROTAS_INTERNAL_SECRET ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("x-internal-secret");
  return Boolean(INTERNAL_SECRET && header === INTERNAL_SECRET);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hoje = new Date().toISOString().slice(0, 10);

  const [kpis, alertas, rankingFrotas, analises] = await Promise.all([
    getRelatorioKpis(hoje),
    listAlertasAbertos(10),
    getRankingFrotas(hoje, 5),
    listAnalisesDia(hoje),
  ]);

  const criticos = analises.filter((a) =>
    ["CRITICO", "BLOQUEIO_SUGERIDO"].includes(a.criticidade_revisada ?? a.criticidade)
  );

  const html = buildEmailHtml({ hoje, kpis, alertas, rankingFrotas, criticos });

  const destinatarios = (process.env.FROTAS_RELATORIO_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

  if (destinatarios.length === 0) {
    return NextResponse.json({ aviso: "FROTAS_RELATORIO_EMAILS não configurado", html });
  }

  await supabaseManutencao.from("email_logs").insert({
    tipo: "RELATORIO_DIARIO_IA",
    destinatarios: destinatarios.join(","),
    assunto: `[Frotas] Relatório IA — ${hoje}`,
    enviado_em: new Date().toISOString(),
    enviado_por: "sistema",
    status: "SIMULADO",
    erro_msg: "Integração de envio pendente — implementar com provedor de e-mail configurado",
  });

  return NextResponse.json({
    data: hoje,
    kpis,
    total_criticos: criticos.length,
    alertas_abertos: alertas.length,
    destinatarios,
    html_preview: html.slice(0, 500),
  });
}

function buildEmailHtml(params: {
  hoje: string;
  kpis: Awaited<ReturnType<typeof getRelatorioKpis>>;
  alertas: Awaited<ReturnType<typeof listAlertasAbertos>>;
  rankingFrotas: Awaited<ReturnType<typeof getRankingFrotas>>;
  criticos: Awaited<ReturnType<typeof listAnalisesDia>>;
}): string {
  const { hoje, kpis, alertas, rankingFrotas, criticos } = params;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
body { font-family: Arial, sans-serif; color: #1e293b; background: #f8fafc; margin: 0; padding: 0; }
.container { max-width: 600px; margin: 0 auto; background: #fff; padding: 24px; }
h1 { color: #1d4ed8; font-size: 20px; }
h2 { font-size: 15px; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
.kpi-grid { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
.kpi { background: #f1f5f9; border-radius: 8px; padding: 12px 16px; min-width: 100px; }
.kpi-value { font-size: 24px; font-weight: bold; }
.kpi-label { font-size: 12px; color: #64748b; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.badge-critico { background: #fee2e2; color: #991b1b; }
.badge-atencao { background: #fef3c7; color: #92400e; }
.badge-ok { background: #d1fae5; color: #065f46; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; padding: 8px; background: #f1f5f9; }
td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
.footer { margin-top: 32px; font-size: 12px; color: #94a3b8; }
</style></head>
<body><div class="container">
  <h1>Frotas Bemol — Relatório IA ${hoje}</h1>

  <h2>Resumo do dia</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-value">${kpis.total_checklists}</div><div class="kpi-label">Checklists</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#059669">${kpis.ok}</div><div class="kpi-label">OK</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#d97706">${kpis.atencao}</div><div class="kpi-label">Atenção</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#dc2626">${kpis.critico}</div><div class="kpi-label">Crítico</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#ea580c">${kpis.manutencao}</div><div class="kpi-label">Manutenção</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#b91c1c">${kpis.bloqueio_sugerido}</div><div class="kpi-label">Bloqueio</div></div>
  </div>

  ${criticos.length > 0 ? `
  <h2>Problemas críticos (${criticos.length})</h2>
  <table><tr><th>Frota</th><th>Criticidade</th><th>Resumo</th><th>Ação</th></tr>
  ${criticos.map((a) => `
  <tr>
    <td>${a.frota_id}</td>
    <td><span class="badge badge-critico">${(a.criticidade_revisada ?? a.criticidade).replace("_", " ")}</span></td>
    <td>${a.resumo_ia ?? "—"}</td>
    <td>${a.acao_recomendada ?? "—"}</td>
  </tr>`).join("")}
  </table>` : "<p>Nenhum problema crítico hoje.</p>"}

  ${rankingFrotas.length > 0 ? `
  <h2>Frotas com mais problemas</h2>
  <table><tr><th>Frota</th><th>Placa</th><th>Problemas</th></tr>
  ${rankingFrotas.map((f) => `<tr><td>${f.frota_geral ?? f.frota_id}</td><td>${f.placa ?? "—"}</td><td>${f.total_problemas}</td></tr>`).join("")}
  </table>` : ""}

  ${alertas.length > 0 ? `
  <h2>Alertas abertos (${alertas.length})</h2>
  <table><tr><th>Tipo</th><th>Frota</th><th>Descrição</th></tr>
  ${alertas.map((a) => `<tr><td>${a.tipo}</td><td>${a.frota_geral ?? a.frota_id}</td><td>${a.descricao ?? "—"}</td></tr>`).join("")}
  </table>` : ""}

  <p><a href="${APP_URL}/relatorios/checklists">Ver painel completo →</a></p>

  <div class="footer">Frotas Bemol · Plataforma Operacional · ${hoje}</div>
</div></body></html>`;
}
```

- [ ] **Step 3: Adicionar variável de ambiente**

```bash
# .env.local
FROTAS_RELATORIO_EMAILS=gestor@bemol.com.br,admin@bemol.com.br
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/api/relatorios/ .env.local
git commit -m "feat: route relatório diário IA com HTML e log de envio"
```

---

## Variáveis de ambiente necessárias (resumo)

Adicionar no Vercel / Azure App Service:

| Variável | Valor | Descrição |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | Chave da OpenAI (já deve existir para OCR) |
| `OPENAI_CHECKLIST_MODEL` | `gpt-4.1-mini` | Modelo para análise de checklist |
| `FROTAS_INTERNAL_SECRET` | string aleatória | Protege routes internas |
| `NEXT_PUBLIC_APP_URL` | `https://gestao-frotas.azurewebsites.net` | URL base para fire-and-forget |
| `FROTAS_RELATORIO_EMAILS` | e-mails separados por vírgula | Destinatários do relatório diário |

---

## Self-Review — Cobertura da Spec

| Requisito da spec | Atendido por |
|---|---|
| Ler checklists do dia | `listAnalisesDia` + `getRelatorioKpis` |
| Corrigir erros de escrita | `analyzeChecklist` → `texto_corrigido` |
| Classificar criticidade (OK/ATENÇÃO/CRÍTICO/MANUTENÇÃO/BLOQUEIO) | `ChecklistAnalysisSchema.criticidade` |
| Identificar frotas com atenção | `getRankingFrotas` + `listAlertasAbertos` |
| Gerar relatórios para admin/gestor | Dashboard `/relatorios/checklists` + e-mail |
| Criar alertas automáticos | `createAlerta` em `processarChecklist` |
| IA não inventa problemas | Instruído no `SYSTEM_PROMPT` |
| Texto original preservado | `texto_original` separado de `texto_corrigido` |
| Justificativa da classificação | campo `justificativa` |
| Todo resultado auditável | tabela `logs_ia` |
| Admin pode revisar/alterar classificação IA | `revisarAnaliseAction` + campo `criticidade_revisada` |
| Não bloquear salvamento se IA falhar | fire-and-forget + fallback retorna `criticidade: "OK"` |
| Nunca expor chave OpenAI no front | Apenas backend: `lib/ai/checklist-analyzer.ts` e routes |
| Validação com Zod | `ChecklistAnalysisSchema` + validação das actions |
| JSON estruturado na resposta IA | `zodTextFormat` via OpenAI SDK |
| Não reprocessar checklist já analisado | check `existente` na route POST |
| `analises_checklist_ia` | Task 1 |
| `alertas_frota` | Task 1 |
| `logs_ia` | Task 1 |
| Dashboard com KPIs, rankings, filtros | Tasks 7+8 (filtros por data como melhoria futura) |
| Relatório diário | Task 9 |
| Filtros por centro/setor/veículo | Melhoria futura — queries base prontas |
