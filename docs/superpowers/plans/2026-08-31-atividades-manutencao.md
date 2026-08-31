# Quadro de atividades de manutenção — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o fluxo manual (WhatsApp + planilha) de atividades de deslocamento de frotas por um quadro dentro do app, com um perfil novo de motorista interno que recebe e conclui as atividades.

**Architecture:** Perfil novo `MOTORISTA_INTERNO` reaproveitando a rota `/motorista` já existente (só ganha uma aba nova). Módulo de criação em `/manutencao/atividades` seguindo o mesmo padrão de `page.tsx` + `_actions.ts` + repo já usado em `/manutencao/pecas`. Tabela nova `atividades_manutencao` no Supabase (RLS service_role, mesmo padrão do resto do banco) + bucket de storage `atividades-media` pra foto de conclusão.

**Tech Stack:** Next.js App Router (Server Actions + `useActionState`), Supabase (Postgres + Storage), Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-atividades-manutencao-design.md`

## Global Constraints

- Motorista interno usa a rota `/motorista` existente — não criar rota separada.
- Só o tipo `LEVAR_PARA` exige foto de conclusão e checklist do dia da frota antes de concluir; `LIBERADA`, `TESTE_PERCURSO`, `OUTRO` têm foto opcional e não exigem checklist.
- `motorista_id` sempre é o e-mail (`usuarios.id`), igual ao resto do banco (`checklists_frota.motorista_id`).
- Sem notificação push/e-mail neste escopo.
- RLS de toda tabela/bucket novo é `service_role`-only, igual ao restante do projeto (ver `atividades_manutencao_service_role` como nome de policy).

---

## Task 1: Perfil `MOTORISTA_INTERNO`

**Files:**
- Modify: `lib/perfis.ts`
- Modify: `lib/rbac.ts`
- Modify: `components/administracao/perfil-badge.tsx`
- Test: `lib/rbac.test.ts`

**Interfaces:**
- Produces: `PerfilUsuario` inclui `"MOTORISTA_INTERNO"`; `canAccessMotorista(perfil)` retorna `true` pra esse perfil; env var `FROTAS_MOTORISTA_INTERNO_EMAILS`.

- [ ] **Step 1: Adicionar o perfil ao enum e ao label**

Em `lib/perfis.ts`, adicionar `"MOTORISTA_INTERNO"` a `PERFIS_USUARIO` (logo após `"MOTORISTA"`) e a entrada correspondente em `PERFIL_LABELS`:

```ts
export const PERFIS_USUARIO = [
  "MOTORISTA",
  "MOTORISTA_INTERNO",
  "PORTARIA",
  "APROVADOR",
  "MANUTENCAO",
  "GESTOR",
  "ADMIN",
  "DEV",
] as const;
```

```ts
export const PERFIL_LABELS: Record<PerfilUsuario, string> = {
  MOTORISTA: "Motorista",
  MOTORISTA_INTERNO: "Motorista interno",
  PORTARIA: "Portaria",
  APROVADOR: "Aprovador de saída",
  MANUTENCAO: "Manutencao",
  GESTOR: "Gestor",
  ADMIN: "Administrador",
  DEV: "Desenvolvedor",
};
```

- [ ] **Step 2: Rodar o typecheck pra achar todo `Record<PerfilUsuario, ...>` que quebrou**

Run: `npx tsc --noEmit -p .`
Expected: erro em `components/administracao/perfil-badge.tsx` (`PERFIL_SEVERITY` não cobre `MOTORISTA_INTERNO`) — é esse erro que os próximos steps corrigem. Anote qualquer outro arquivo que aparecer no erro além do já previsto neste plano.

- [ ] **Step 3: Corrigir `perfil-badge.tsx`**

Em `components/administracao/perfil-badge.tsx`, adicionar a entrada em `PERFIL_SEVERITY` (usa o tom `MANUTENCAO`, já existente no design system, pra sinalizar que é um perfil ligado ao time de manutenção):

```ts
const PERFIL_SEVERITY: Record<PerfilUsuario, SeverityKey> = {
  MOTORISTA: "INFO",
  MOTORISTA_INTERNO: "MANUTENCAO",
  PORTARIA: "ATENCAO",
  APROVADOR: "OK",
  MANUTENCAO: "MANUTENCAO",
  GESTOR: "OK",
  ADMIN: "BLOQUEIO",
  DEV: "NEUTRO",
};
```

- [ ] **Step 4: Adicionar a env var e o `canAccessMotorista`**

Em `lib/rbac.ts`, junto das outras listas de e-mail (logo abaixo de `DRIVER_EMAILS`):

```ts
const MOTORISTA_INTERNO_EMAILS = parseList(process.env.FROTAS_MOTORISTA_INTERNO_EMAILS);
```

Em `resolvePerfilFromEnv`, checar antes do fallback pro motorista comum (a ordem importa: um e-mail cadastrado nas duas listas deve resolver pro perfil mais específico):

```ts
export function resolvePerfilFromEnv(email: string): PerfilUsuario {
  const normalized = email.toLowerCase();

  const isProd = process.env.NODE_ENV === "production";
  if (!isProd && hasEmail(DEV_EMAILS, normalized)) return "DEV";
  if (hasEmail(ADMIN_EMAILS, normalized)) return "ADMIN";
  if (hasEmail(APPROVER_EMAILS, normalized)) return "APROVADOR";
  if (hasEmail(MANAGER_EMAILS, normalized)) return "GESTOR";
  if (hasEmail(MAINTENANCE_EMAILS, normalized)) return "MANUTENCAO";
  if (hasEmail(PORTARIA_EMAILS, normalized)) return "PORTARIA";
  if (hasEmail(MOTORISTA_INTERNO_EMAILS, normalized)) return "MOTORISTA_INTERNO";
  if (hasEmail(DRIVER_EMAILS, normalized)) return "MOTORISTA";

  const fallback = (process.env.FROTAS_DEFAULT_PROFILE ?? "").toUpperCase();
  if (isPerfilUsuario(fallback) && fallback !== "ADMIN") {
    return fallback;
  }

  return "MOTORISTA";
}
```

E `canAccessMotorista`:

```ts
export function canAccessMotorista(perfil: PerfilUsuario): boolean {
  return (
    perfil === "MOTORISTA" ||
    perfil === "MOTORISTA_INTERNO" ||
    perfil === "ADMIN" ||
    perfil === "GESTOR" ||
    perfil === "DEV"
  );
}
```

- [ ] **Step 5: Escrever os testes**

Em `lib/rbac.test.ts`, importar `canAccessMotorista` de `@/lib/rbac` e adicionar:

```ts
import { canAccessMotorista } from "@/lib/rbac";

describe("acesso do motorista interno", () => {
  it("permite que MOTORISTA_INTERNO acesse a área do motorista", () => {
    expect(canAccessMotorista("MOTORISTA_INTERNO")).toBe(true);
  });

  it("mantém MOTORISTA e os perfis administrativos com acesso", () => {
    expect(canAccessMotorista("MOTORISTA")).toBe(true);
    expect(canAccessMotorista("ADMIN")).toBe(true);
  });

  it("bloqueia perfis sem relação com a área do motorista", () => {
    expect(canAccessMotorista("PORTARIA")).toBe(false);
    expect(canAccessMotorista("MANUTENCAO")).toBe(false);
  });
});
```

- [ ] **Step 6: Rodar os testes e o typecheck**

Run: `npx vitest run lib/rbac.test.ts && npx tsc --noEmit -p .`
Expected: PASS, sem erros de tipo em nenhum arquivo.

- [ ] **Step 7: Commit**

```bash
git add lib/perfis.ts lib/rbac.ts lib/rbac.test.ts components/administracao/perfil-badge.tsx
git commit -m "feat: adiciona perfil MOTORISTA_INTERNO"
```

---

## Task 2: Tabela `atividades_manutencao` + bucket de storage

**Files:**
- Create: `supabase/migrations/20260901120000_atividades_manutencao.sql`

**Interfaces:**
- Produces: tabela `public.atividades_manutencao` (colunas: `id`, `frota_id`, `frota_codigo`, `tipo`, `local`, `observacao`, `motorista_id`, `motorista_nome`, `status`, `foto_conclusao_path`, `criado_por_email`, `criado_por_nome`, `criado_em`, `concluido_em`, `atualizado_em`); bucket privado `atividades-media`.

- [ ] **Step 1: Escrever a migration**

```sql
-- Substitui o controle manual (WhatsApp + planilha) de deslocamento de
-- frotas entre unidades por um quadro de atividades dentro do app.
begin;

create table if not exists public.atividades_manutencao (
  id bigserial primary key,
  frota_id bigint not null references public.veiculos(id) on delete cascade,
  frota_codigo text not null,
  tipo text not null check (tipo in ('LEVAR_PARA', 'LIBERADA', 'TESTE_PERCURSO', 'OUTRO')),
  local text not null,
  observacao text,
  motorista_id text not null references public.usuarios(id),
  motorista_nome text not null,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'CONCLUIDA')),
  foto_conclusao_path text,
  criado_por_email text not null,
  criado_por_nome text not null,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create index if not exists atividades_manutencao_motorista_status_idx
  on public.atividades_manutencao (motorista_id, status);
create index if not exists atividades_manutencao_frota_idx
  on public.atividades_manutencao (frota_id);

alter table public.atividades_manutencao enable row level security;

drop policy if exists atividades_manutencao_service_role on public.atividades_manutencao;
create policy atividades_manutencao_service_role on public.atividades_manutencao
  for all using (public.is_service_role()) with check (public.is_service_role());

insert into storage.buckets (id, name, public)
values ('atividades-media', 'atividades-media', false)
on conflict (id) do update set public = false;

commit;
```

- [ ] **Step 2: Aplicar no banco via Supabase MCP**

Usar `mcp__claude_ai_Supabase__apply_migration` com `project_id: "nwoqastjgkgsifmxdqwp"`, `name: "atividades_manutencao"` e o SQL acima (sem o `begin`/`commit`, a tool já trata como transação).

- [ ] **Step 3: Verificar advisories de segurança**

Usar `mcp__claude_ai_Supabase__get_advisors` com `project_id: "nwoqastjgkgsifmxdqwp"` e `type: "security"`.
Expected: nenhum novo alerta pra `atividades_manutencao` (deve aparecer só a policy `service_role`, igual ao padrão de `pedidos_pecas`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260901120000_atividades_manutencao.sql
git commit -m "feat: adiciona tabela e bucket de atividades de manutenção"
```

---

## Task 3: Regras puras (`lib/atividades/rules.ts`)

**Files:**
- Create: `lib/atividades/rules.ts`
- Test: `lib/atividades/rules.test.ts`

**Interfaces:**
- Produces:
  - `AtividadeTipo = "LEVAR_PARA" | "LIBERADA" | "TESTE_PERCURSO" | "OUTRO"`
  - `TIPO_ATIVIDADE_LABELS: Record<AtividadeTipo, string>`
  - `requiresFotoNaConclusao(tipo: AtividadeTipo): boolean`
  - `requiresChecklistDoDia(tipo: AtividadeTipo): boolean`
  - `formatDuracao(inicioIso: string, fimIso: string): string` (ex: `"2h35min"`, `"45min"`, `"3min"`)

- [ ] **Step 1: Escrever os testes**

```ts
import { describe, expect, it } from "vitest";
import {
  formatDuracao,
  requiresChecklistDoDia,
  requiresFotoNaConclusao,
} from "@/lib/atividades/rules";

describe("requiresFotoNaConclusao", () => {
  it("exige foto só para LEVAR_PARA", () => {
    expect(requiresFotoNaConclusao("LEVAR_PARA")).toBe(true);
    expect(requiresFotoNaConclusao("LIBERADA")).toBe(false);
    expect(requiresFotoNaConclusao("TESTE_PERCURSO")).toBe(false);
    expect(requiresFotoNaConclusao("OUTRO")).toBe(false);
  });
});

describe("requiresChecklistDoDia", () => {
  it("exige checklist do dia só para LEVAR_PARA", () => {
    expect(requiresChecklistDoDia("LEVAR_PARA")).toBe(true);
    expect(requiresChecklistDoDia("LIBERADA")).toBe(false);
    expect(requiresChecklistDoDia("TESTE_PERCURSO")).toBe(false);
    expect(requiresChecklistDoDia("OUTRO")).toBe(false);
  });
});

describe("formatDuracao", () => {
  it("formata minutos quando menor que uma hora", () => {
    const inicio = "2026-08-31T10:00:00.000Z";
    const fim = "2026-08-31T10:45:00.000Z";
    expect(formatDuracao(inicio, fim)).toBe("45min");
  });

  it("formata horas e minutos quando maior ou igual a uma hora", () => {
    const inicio = "2026-08-31T10:00:00.000Z";
    const fim = "2026-08-31T12:35:00.000Z";
    expect(formatDuracao(inicio, fim)).toBe("2h35min");
  });

  it("arredonda pra baixo até o minuto completo e nunca mostra negativo", () => {
    const inicio = "2026-08-31T10:00:00.000Z";
    const fim = "2026-08-31T10:00:40.000Z";
    expect(formatDuracao(inicio, fim)).toBe("0min");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run lib/atividades/rules.test.ts`
Expected: FAIL — `Cannot find module '@/lib/atividades/rules'`

- [ ] **Step 3: Implementar**

```ts
export const ATIVIDADE_TIPOS = ["LEVAR_PARA", "LIBERADA", "TESTE_PERCURSO", "OUTRO"] as const;
export type AtividadeTipo = (typeof ATIVIDADE_TIPOS)[number];

export const TIPO_ATIVIDADE_LABELS: Record<AtividadeTipo, string> = {
  LEVAR_PARA: "Levar para",
  LIBERADA: "Liberada em",
  TESTE_PERCURSO: "Teste de percurso",
  OUTRO: "Outro",
};

export function requiresFotoNaConclusao(tipo: AtividadeTipo): boolean {
  return tipo === "LEVAR_PARA";
}

export function requiresChecklistDoDia(tipo: AtividadeTipo): boolean {
  return tipo === "LEVAR_PARA";
}

export function formatDuracao(inicioIso: string, fimIso: string): string {
  const inicio = new Date(inicioIso).getTime();
  const fim = new Date(fimIso).getTime();
  const minutosTotais = Math.max(0, Math.floor((fim - inicio) / 60_000));
  const horas = Math.floor(minutosTotais / 60);
  const minutos = minutosTotais % 60;
  if (horas === 0) return `${minutos}min`;
  return `${horas}h${String(minutos).padStart(2, "0")}min`;
}
```

- [ ] **Step 4: Rodar os testes de novo**

Run: `npx vitest run lib/atividades/rules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/atividades/rules.ts lib/atividades/rules.test.ts
git commit -m "feat: regras de foto/checklist/duração das atividades de manutenção"
```

---

## Task 4: Repos (`atividades-manutencao.ts` + `atividades-media.ts`)

**Files:**
- Create: `lib/repos/atividades-manutencao.ts`
- Create: `lib/repos/atividades-media.ts`

**Interfaces:**
- Consumes: `supabaseManutencao` de `@/lib/supabase-manutencao`; `sanitizeImageForStorage` de `@/lib/upload-validation`; `AtividadeTipo` de `@/lib/atividades/rules`.
- Produces:
  - `type AtividadeManutencao = { id: number; frota_id: number; frota_codigo: string; tipo: AtividadeTipo; local: string; observacao: string | null; motorista_id: string; motorista_nome: string; status: "PENDENTE" | "CONCLUIDA"; foto_conclusao_path: string | null; criado_por_email: string; criado_por_nome: string; criado_em: string; concluido_em: string | null }`
  - `listAtividades(filters: { status?: "PENDENTE" | "CONCLUIDA"; motoristaId?: string }): Promise<AtividadeManutencao[]>`
  - `listAtividadesPendentesPorMotorista(motoristaId: string): Promise<AtividadeManutencao[]>`
  - `listAtividadesRecentesPorMotorista(motoristaId: string, limit?: number): Promise<AtividadeManutencao[]>`
  - `criarAtividade(input: { frotaId: number; frotaCodigo: string; tipo: AtividadeTipo; local: string; observacao: string | null; motoristaId: string; motoristaNome: string; criadoPorEmail: string; criadoPorNome: string }): Promise<AtividadeManutencao>`
  - `concluirAtividade(id: number, input: { fotoPath: string | null }): Promise<void>`
  - `uploadAtividadeImage(file: File, args: { atividadeId: number }): Promise<string>`
  - `createSignedAtividadeImageUrl(path: string, expiresIn?: number): Promise<string>`

- [ ] **Step 1: Repo de dados — `lib/repos/atividades-manutencao.ts`**

```ts
import "server-only";
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { AtividadeTipo } from "@/lib/atividades/rules";

export type AtividadeManutencao = {
  id: number;
  frota_id: number;
  frota_codigo: string;
  tipo: AtividadeTipo;
  local: string;
  observacao: string | null;
  motorista_id: string;
  motorista_nome: string;
  status: "PENDENTE" | "CONCLUIDA";
  foto_conclusao_path: string | null;
  criado_por_email: string;
  criado_por_nome: string;
  criado_em: string;
  concluido_em: string | null;
};

const ATIVIDADE_COLUMNS =
  "id,frota_id,frota_codigo,tipo,local,observacao,motorista_id,motorista_nome,status,foto_conclusao_path,criado_por_email,criado_por_nome,criado_em,concluido_em";

export type AtividadeFilters = {
  status?: "PENDENTE" | "CONCLUIDA";
  motoristaId?: string;
};

export async function listAtividades(filters: AtividadeFilters = {}): Promise<AtividadeManutencao[]> {
  let query = supabaseManutencao
    .from("atividades_manutencao")
    .select(ATIVIDADE_COLUMNS)
    .order("criado_em", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.motoristaId) query = query.eq("motorista_id", filters.motoristaId);
  const { data, error } = await query;
  if (error) throw new Error(`listAtividades: ${error.message}`);
  return (data ?? []) as AtividadeManutencao[];
}

export async function listAtividadesPendentesPorMotorista(motoristaId: string): Promise<AtividadeManutencao[]> {
  const { data, error } = await supabaseManutencao
    .from("atividades_manutencao")
    .select(ATIVIDADE_COLUMNS)
    .eq("motorista_id", motoristaId)
    .eq("status", "PENDENTE")
    .order("criado_em", { ascending: true });
  if (error) throw new Error(`listAtividadesPendentesPorMotorista: ${error.message}`);
  return (data ?? []) as AtividadeManutencao[];
}

export async function listAtividadesRecentesPorMotorista(
  motoristaId: string,
  limit = 20
): Promise<AtividadeManutencao[]> {
  const { data, error } = await supabaseManutencao
    .from("atividades_manutencao")
    .select(ATIVIDADE_COLUMNS)
    .eq("motorista_id", motoristaId)
    .eq("status", "CONCLUIDA")
    .order("concluido_em", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listAtividadesRecentesPorMotorista: ${error.message}`);
  return (data ?? []) as AtividadeManutencao[];
}

export type CriarAtividadeInput = {
  frotaId: number;
  frotaCodigo: string;
  tipo: AtividadeTipo;
  local: string;
  observacao: string | null;
  motoristaId: string;
  motoristaNome: string;
  criadoPorEmail: string;
  criadoPorNome: string;
};

export async function criarAtividade(input: CriarAtividadeInput): Promise<AtividadeManutencao> {
  const { data, error } = await supabaseManutencao
    .from("atividades_manutencao")
    .insert({
      frota_id: input.frotaId,
      frota_codigo: input.frotaCodigo,
      tipo: input.tipo,
      local: input.local,
      observacao: input.observacao,
      motorista_id: input.motoristaId,
      motorista_nome: input.motoristaNome,
      criado_por_email: input.criadoPorEmail,
      criado_por_nome: input.criadoPorNome,
    })
    .select(ATIVIDADE_COLUMNS)
    .single();
  if (error) throw new Error(`criarAtividade: ${error.message}`);
  return data as AtividadeManutencao;
}

export async function concluirAtividade(id: number, input: { fotoPath: string | null }): Promise<void> {
  const { error } = await supabaseManutencao
    .from("atividades_manutencao")
    .update({
      status: "CONCLUIDA",
      concluido_em: new Date().toISOString(),
      foto_conclusao_path: input.fotoPath,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "PENDENTE");
  if (error) throw new Error(`concluirAtividade: ${error.message}`);
}
```

- [ ] **Step 2: Repo de storage — `lib/repos/atividades-media.ts`**

```ts
import { randomUUID } from "node:crypto";
import { sanitizeImageForStorage } from "@/lib/upload-validation";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export const ATIVIDADES_MEDIA_BUCKET = "atividades-media";

export async function uploadAtividadeImage(file: File, args: { atividadeId: number }): Promise<string> {
  const sanitized = await sanitizeImageForStorage(file, "Foto de conclusão");
  const path = `${args.atividadeId}/conclusao-${Date.now()}-${randomUUID()}.${sanitized.extension}`;

  const { error } = await supabaseManutencao.storage.from(ATIVIDADES_MEDIA_BUCKET).upload(path, sanitized.buffer, {
    cacheControl: "3600",
    contentType: sanitized.contentType,
    upsert: false,
  });

  if (error) throw new Error(`uploadAtividadeImage: ${error.message}`);
  return path;
}

export async function createSignedAtividadeImageUrl(path: string, expiresIn = 60 * 30): Promise<string> {
  const { data, error } = await supabaseManutencao.storage
    .from(ATIVIDADES_MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`createSignedAtividadeImageUrl: ${error?.message ?? "URL assinada indisponível"}`);
  }

  return data.signedUrl;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: sem erros novos nesses dois arquivos.

- [ ] **Step 4: Commit**

```bash
git add lib/repos/atividades-manutencao.ts lib/repos/atividades-media.ts
git commit -m "feat: repositórios de atividades de manutenção"
```

---

## Task 5: Checagem de checklist do dia (`lib/repos/checklists.ts`)

**Files:**
- Modify: `lib/repos/checklists.ts`
- Test: `lib/repos/checklists.test.ts` (criar se não existir)

**Interfaces:**
- Consumes: `todayRange()` (já existe no arquivo, via `reportDayUtcRange`/`reportCalendarDate`).
- Produces: `existsChecklistHojeParaFrota(motoristaId: string, frotaId: number): Promise<boolean>`

- [ ] **Step 1: Verificar se já existe teste pro arquivo**

Run: `ls lib/repos/checklists.test.ts 2>&1 || echo "not found"`

Se não existir, o Step 2 cria o arquivo do zero; se existir, adicionar a `describe` nova nele.

- [ ] **Step 2: Escrever o teste**

Seguir o mesmo padrão de mock encadeado (um único objeto `chain` que se retorna, terminando numa Promise) já usado em `lib/repos/usuarios.test.ts`:

```ts
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

const state: { rows: Array<{ id: number }> } = { rows: [] };

function makeChain() {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    limit: vi.fn(async () => ({ data: state.rows, error: null })),
  };
  return chain;
}

vi.mock("@/lib/supabase-manutencao", () => ({
  supabaseManutencao: { from: vi.fn(() => makeChain()) },
}));

import { describe, expect, it, beforeEach } from "vitest";
import { existsChecklistHojeParaFrota } from "@/lib/repos/checklists";

describe("existsChecklistHojeParaFrota", () => {
  beforeEach(() => {
    state.rows = [];
  });

  it("retorna true quando existe checklist do motorista pra frota hoje", async () => {
    state.rows = [{ id: 1 }];
    const result = await existsChecklistHojeParaFrota("motorista@bemol.com.br", 300);
    expect(result).toBe(true);
  });

  it("retorna false quando não há checklist hoje", async () => {
    state.rows = [];
    const result = await existsChecklistHojeParaFrota("motorista@bemol.com.br", 300);
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run lib/repos/checklists.test.ts`
Expected: FAIL — `existsChecklistHojeParaFrota is not a function` (ou erro de import).

- [ ] **Step 4: Implementar**

Adicionar em `lib/repos/checklists.ts`, próximo de `listDriverChecklists` (usa o `todayRange()` já definido no arquivo, em `lib/repos/checklists.ts:223-225`):

```ts
export async function existsChecklistHojeParaFrota(motoristaId: string, frotaId: number): Promise<boolean> {
  const { start, end } = todayRange();
  const { data, error } = await supabaseManutencao
    .from("checklists_frota")
    .select("id")
    .eq("motorista_id", motoristaId)
    .eq("frota_id", frotaId)
    .gte("data_checklist", start)
    .lt("data_checklist", end)
    .limit(1);
  if (error) throw new Error(`existsChecklistHojeParaFrota: ${error.message}`);
  return (data ?? []).length > 0;
}
```

- [ ] **Step 5: Rodar de novo e confirmar que passa**

Run: `npx vitest run lib/repos/checklists.test.ts`
Expected: PASS

- [ ] **Step 6: Typecheck geral**

Run: `npx tsc --noEmit -p .`
Expected: sem erros novos.

- [ ] **Step 7: Commit**

```bash
git add lib/repos/checklists.ts lib/repos/checklists.test.ts
git commit -m "feat: checagem de checklist do dia por frota e motorista"
```

---

## Task 6: Navegação — sidebar e nav config

**Files:**
- Modify: `lib/navigation-config.ts`

**Interfaces:**
- Consumes: `canAccessManutencao` (já importado no arquivo).
- Produces: seção "Manutenção" com item "Atividades"; seção própria de navegação pro perfil `MOTORISTA_INTERNO`.

- [ ] **Step 1: Adicionar o item ao menu de manutenção**

Em `lib/navigation-config.ts`, dentro de `MANUTENCAO_NAV`, logo após o item de pedidos de peças:

```ts
const MANUTENCAO_NAV: NavItem[] = [
  { href: "/planejamento/manutencao", label: "Manutenção", icon: "Wrench" },
  { href: "/manutencao/pecas", label: "Pedidos de peças", icon: "PackageSearch" },
  { href: "/manutencao/atividades", label: "Atividades", icon: "ClipboardCheck" },
  { href: "/manutencao/ordens", label: "Ordens", icon: "FileText" },
  { href: "/manutencao/custos", label: "Custos", icon: "BarChart2" },
  { href: "/oficinas", label: "Oficinas", icon: "MapPin" },
  { href: "/planejamento/lavagem", label: "Lavagem", icon: "ClipboardCheck" },
  { href: "/planejamento/bateria", label: "Bateria", icon: "Wrench" },
  { href: "/planejamento/seguranca", label: "Kit Segurança", icon: "ShieldAlert" },
  { href: "/planejamento/manutencao/tacografo", label: "Tacógrafo", icon: "ClipboardCheck" },
];
```

- [ ] **Step 2: Criar a nav do motorista interno e tratar o perfil em `navigationForProfile`**

Adicionar, próximo de `MOTORISTA_NAV`:

```ts
const MOTORISTA_INTERNO_NAV: NavItem[] = [
  { href: "/motorista", label: "Início", icon: "Home" },
  { href: "/motorista/atividades", label: "Atividades", icon: "ClipboardCheck" },
  { href: "/motorista/checklist", label: "Fazer Checklist", icon: "ClipboardCheck" },
  { href: "/motorista/sinistro", label: "Reportar Sinistro", icon: "AlertTriangle" },
  { href: "/motorista/sinistros", label: "Meus Sinistros", icon: "ShieldAlert" },
  { href: "/motorista/checklists", label: "Meus Checklists", icon: "List" },
  { href: "/motorista/historico", label: "Meu histórico", icon: "History" },
];
```

E no início de `navigationForProfile` (logo abaixo do `if (perfil === "MOTORISTA")`):

```ts
export function navigationForProfile(perfil: PerfilUsuario): NavSection[] {
  if (perfil === "MOTORISTA") return [{ title: "Motorista", items: MOTORISTA_NAV }];

  if (perfil === "MOTORISTA_INTERNO") {
    return [{ title: "Motorista", items: MOTORISTA_INTERNO_NAV }];
  }

  if (perfil === "APROVADOR") return [{ title: "Aprovação", items: PORTARIA_NAV }];
  // ... resto inalterado
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add lib/navigation-config.ts
git commit -m "feat: navegação do motorista interno e link de atividades na manutenção"
```

---

## Task 7: Módulo de criação — `/manutencao/atividades`

**Files:**
- Create: `app/(app)/manutencao/atividades/page.tsx`
- Create: `app/(app)/manutencao/atividades/_actions.ts`
- Create: `components/manutencao/atividade-form.tsx`

**Interfaces:**
- Consumes: `listFrotasForOperationalForms` (`@/lib/repos/frotas`), `listUsuarios` (`@/lib/repos/usuarios`), `listAtividades`/`criarAtividade` (`@/lib/repos/atividades-manutencao`), `VehicleSearchSelect` (`@/components/vehicles/vehicle-search-select`), `ATIVIDADE_TIPOS`/`TIPO_ATIVIDADE_LABELS`/`formatDuracao` (`@/lib/atividades/rules`), `requireManutencaoUser` (`@/lib/rbac`).
- Produces: rota `/manutencao/atividades` e a server action `criarAtividadeAction`.

- [ ] **Step 1: Server action — `_actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireManutencaoUser } from "@/lib/rbac";
import { getFrota } from "@/lib/repos/frotas";
import { getUsuarioById } from "@/lib/repos/usuarios";
import { criarAtividade } from "@/lib/repos/atividades-manutencao";
import { ATIVIDADE_TIPOS } from "@/lib/atividades/rules";
import { publicActionError } from "@/lib/public-error";

const CriarAtividadeSchema = z.object({
  frotaId: z.coerce.number().int().positive("Selecione uma frota."),
  tipo: z.enum(ATIVIDADE_TIPOS, { message: "Selecione o tipo de atividade." }),
  local: z.string().trim().min(1, "Informe o local."),
  observacao: z.string().trim().optional(),
  motoristaId: z.string().trim().min(1, "Selecione o motorista."),
});

export type AtividadeActionState = {
  error: string | null;
  attempt: number;
};

export async function criarAtividadeAction(
  previousState: AtividadeActionState,
  formData: FormData
): Promise<AtividadeActionState> {
  const user = await requireManutencaoUser();

  try {
    const parsed = CriarAtividadeSchema.parse({
      frotaId: formData.get("frota_id"),
      tipo: formData.get("tipo"),
      local: formData.get("local"),
      observacao: formData.get("observacao") || undefined,
      motoristaId: formData.get("motorista_id"),
    });

    const frota = await getFrota(parsed.frotaId);
    if (!frota || !frota.ativo || frota.vendido) throw new Error("Frota não encontrada ou inativa.");

    const motorista = await getUsuarioById(parsed.motoristaId);
    if (!motorista || motorista.perfil !== "MOTORISTA_INTERNO" || !motorista.ativo) {
      throw new Error("Selecione um motorista interno ativo.");
    }

    await criarAtividade({
      frotaId: frota.id,
      frotaCodigo: frota.frota_geral ?? String(frota.id),
      tipo: parsed.tipo,
      local: parsed.local,
      observacao: parsed.observacao ?? null,
      motoristaId: motorista.id,
      motoristaNome: motorista.nome ?? motorista.email,
      criadoPorEmail: user.email,
      criadoPorNome: user.name,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Revise os dados da atividade.", attempt: previousState.attempt + 1 };
    }
    return { error: publicActionError(error, "Não foi possível criar a atividade."), attempt: previousState.attempt + 1 };
  }

  revalidatePath("/manutencao/atividades");
  return { error: null, attempt: previousState.attempt + 1 };
}
```

- [ ] **Step 2: Formulário client — `components/manutencao/atividade-form.tsx`**

```tsx
"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import type { AtividadeActionState } from "@/app/(app)/manutencao/atividades/_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VehicleSearchSelect, type VehicleOption } from "@/components/vehicles/vehicle-search-select";
import { ATIVIDADE_TIPOS, TIPO_ATIVIDADE_LABELS } from "@/lib/atividades/rules";

const INITIAL_STATE: AtividadeActionState = { error: null, attempt: 0 };

export type MotoristaInternoOption = { id: string; nome: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Send className="h-4 w-4" aria-hidden="true" />
      {pending ? "Enviando..." : "Criar atividade"}
    </Button>
  );
}

export function AtividadeForm({
  vehicles,
  motoristas,
  action,
}: {
  vehicles: VehicleOption[];
  motoristas: MotoristaInternoOption[];
  action: (state: AtividadeActionState, formData: FormData) => Promise<AtividadeActionState>;
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [frotaId, setFrotaId] = useState<number | null>(null);
  const [tipo, setTipo] = useState<string>("LEVAR_PARA");
  const [motoristaId, setMotoristaId] = useState<string>("");

  return (
    <form key={state.attempt} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="frota_id" value={frotaId ?? ""} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="motorista_id" value={motoristaId} />

      <div className="sm:col-span-2 space-y-1.5">
        <Label>Frota</Label>
        <VehicleSearchSelect vehicles={vehicles} value={frotaId} onChange={(v) => setFrotaId(v?.id ?? null)} />
      </div>

      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ATIVIDADE_TIPOS.map((t) => (
              <SelectItem key={t} value={t}>{TIPO_ATIVIDADE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Motorista</Label>
        <Select value={motoristaId} onValueChange={setMotoristaId}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {motoristas.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="local">Local</Label>
        <Input id="local" name="local" placeholder="Ex.: BONFIM, GALPÃO DA TS..." required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observacao">Observação (opcional)</Label>
        <Input id="observacao" name="observacao" />
      </div>

      {state.error ? (
        <p className="sm:col-span-2 text-sm font-medium text-red-700">{state.error}</p>
      ) : null}

      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Página — `page.tsx`**

```tsx
import { ClipboardCheck } from "lucide-react";
import { AtividadeForm } from "@/components/manutencao/atividade-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { listAtividades } from "@/lib/repos/atividades-manutencao";
import { listFrotasForOperationalForms } from "@/lib/repos/frotas";
import { listUsuarios } from "@/lib/repos/usuarios";
import { requireManutencaoUser } from "@/lib/rbac";
import { formatDuracao, TIPO_ATIVIDADE_LABELS } from "@/lib/atividades/rules";
import { criarAtividadeAction } from "./_actions";

export const dynamic = "force-dynamic";

export default async function AtividadesManutencaoPage() {
  await requireManutencaoUser();
  const [frotas, motoristas, atividades] = await Promise.all([
    listFrotasForOperationalForms(),
    listUsuarios({ perfil: "MOTORISTA_INTERNO", ativo: "ativos" }),
    listAtividades(),
  ]);

  const vehicles = frotas.map((frota) => ({
    id: frota.id,
    codigo: frota.frota_geral,
    placa: frota.placa,
    modelo: frota.modelo,
    localizacao: frota.localizacao,
    ativo: frota.ativo,
    vendido: frota.vendido,
  }));

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Manutenção"
        title="Atividades"
        description={`${atividades.filter((a) => a.status === "PENDENTE").length} pendente(s) de ${atividades.length} atividade(s).`}
        icon={ClipboardCheck}
        severity="INFO"
      />

      <section className="rounded-md border bg-white p-4 shadow-sm sm:p-5">
        <SectionHeader title="Nova atividade" />
        <div className="mt-4">
          <AtividadeForm
            vehicles={vehicles}
            motoristas={motoristas.map((m) => ({ id: m.id, nome: m.nome ?? m.email }))}
            action={criarAtividadeAction}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Todas as atividades" />
        {atividades.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhuma atividade registrada"
            description="Crie a primeira atividade acima."
          />
        ) : (
          <div className="overflow-x-auto rounded-md border bg-white shadow-sm">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Frota</th>
                  <th className="px-3 py-3">Atividade</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Motorista</th>
                  <th className="px-3 py-3">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {atividades.map((atividade) => (
                  <tr key={atividade.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">{atividade.frota_codigo}</td>
                    <td className="px-3 py-3 text-slate-700">
                      {TIPO_ATIVIDADE_LABELS[atividade.tipo]} {atividade.local}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className={atividade.status === "CONCLUIDA" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}>
                        {atividade.status === "CONCLUIDA" ? "Concluída" : "Pendente"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{atividade.motorista_nome}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {atividade.tipo === "LEVAR_PARA" && atividade.concluido_em
                        ? formatDuracao(atividade.criado_em, atividade.concluido_em)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: sem erros. Se `getUsuarioById` não aceitar o formato usado, ajustar a chamada conforme a assinatura real em `lib/repos/usuarios.ts:197`.

- [ ] **Step 5: Testar manualmente**

Rodar `npm run dev`, logar com um e-mail em `FROTAS_MANUTENCAO_EMAILS`, abrir `/manutencao/atividades`, criar uma atividade de teste (tipo `OUTRO`, pra não depender de motorista interno cadastrado ainda) e confirmar que aparece na tabela como "Pendente".

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/manutencao/atividades" components/manutencao/atividade-form.tsx
git commit -m "feat: tela de criação de atividades de manutenção"
```

---

## Task 8: Bottom bar e layout do motorista

**Files:**
- Modify: `components/motorista/bottom-action-bar.tsx`
- Modify: `app/(app)/motorista/layout.tsx`

**Interfaces:**
- Consumes: `AppUser` (`@/lib/rbac`).
- Produces: `MotoristaBottomBar` aceita `perfil: PerfilUsuario` e inclui o item "Atividades" quando `perfil === "MOTORISTA_INTERNO"`.

- [ ] **Step 1: Tornar os itens da bottom bar dependentes do perfil**

Em `components/motorista/bottom-action-bar.tsx`, trocar a constante fixa `ITEMS` por uma função e receber `perfil` via prop:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ClipboardCheck, ClipboardList, Home, List, ShieldAlert } from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import type { PerfilUsuario } from "@/lib/rbac";

type Item = {
  href: string;
  label: string;
  icon: ComponentType<LucideProps>;
};

const BASE_ITEMS: Item[] = [
  { href: "/motorista", label: "Início", icon: Home },
  { href: "/motorista/checklist", label: "Checklist", icon: ClipboardCheck },
  { href: "/motorista/sinistro", label: "Sinistro", icon: AlertTriangle },
  { href: "/motorista/checklists", label: "Histórico", icon: List },
  { href: "/motorista/sinistros", label: "Sinistros", icon: ShieldAlert },
];

function itemsForPerfil(perfil: PerfilUsuario): Item[] {
  if (perfil !== "MOTORISTA_INTERNO") return BASE_ITEMS;
  return [
    BASE_ITEMS[0],
    { href: "/motorista/atividades", label: "Atividades", icon: ClipboardList },
    ...BASE_ITEMS.slice(1),
  ];
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/motorista") return pathname === "/motorista";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MotoristaBottomBar({ perfil }: { perfil: PerfilUsuario }) {
  const pathname = usePathname();
  const items = itemsForPerfil(perfil);

  return (
    <>
      <div aria-hidden="true" className="h-20 lg:hidden" />

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/90 backdrop-blur-md lg:hidden",
          "shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)]"
        )}
        aria-label="Navegação do motorista"
      >
        <ul className={cn("grid gap-1 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2", items.length === 6 ? "grid-cols-6" : "grid-cols-5")}>
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex justify-center">
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-slate-500 transition-all duration-150 hover:bg-slate-50",
                    active && "bg-blue-50 text-blue-700"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className={cn("text-[10px] font-medium", active && "font-semibold")}>
                    {item.label}
                  </span>
                  {active && (
                    <span
                      className="pointer-events-none absolute inset-x-3 top-0 h-[2px] rounded-b-full bg-gradient-to-r from-blue-400 to-sky-500"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
```

- [ ] **Step 2: Passar o perfil no layout**

Em `app/(app)/motorista/layout.tsx`:

```tsx
import { requireMotoristaUser } from "@/lib/rbac";
import { MotoristaBottomBar } from "@/components/motorista/bottom-action-bar";

export default async function MotoristaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMotoristaUser();
  const showBottomBar = user.perfil === "MOTORISTA" || user.perfil === "MOTORISTA_INTERNO";
  return (
    <>
      {children}
      {showBottomBar ? <MotoristaBottomBar perfil={user.perfil} /> : null}
    </>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 4: Testar manualmente**

Com um usuário `MOTORISTA_INTERNO` (adicionar temporariamente o e-mail de teste em `FROTAS_MOTORISTA_INTERNO_EMAILS` no `.env` local), abrir `/motorista` e confirmar que a bottom bar mostra 6 abas, incluindo "Atividades", e que um usuário `MOTORISTA` comum continua vendo as 5 de sempre.

- [ ] **Step 5: Commit**

```bash
git add components/motorista/bottom-action-bar.tsx "app/(app)/motorista/layout.tsx"
git commit -m "feat: aba de atividades na navegação do motorista interno"
```

---

## Task 9: Conclusão de atividades — `/motorista/atividades`

**Files:**
- Create: `app/(app)/motorista/atividades/page.tsx`
- Create: `app/(app)/motorista/atividades/_actions.ts`
- Create: `components/motorista/concluir-atividade-form.tsx`

**Interfaces:**
- Consumes: `listAtividadesPendentesPorMotorista`/`listAtividadesRecentesPorMotorista`/`concluirAtividade` (`@/lib/repos/atividades-manutencao`), `uploadAtividadeImage` (`@/lib/repos/atividades-media`), `existsChecklistHojeParaFrota` (`@/lib/repos/checklists`), `requiresFotoNaConclusao`/`requiresChecklistDoDia`/`formatDuracao`/`TIPO_ATIVIDADE_LABELS` (`@/lib/atividades/rules`), `requireMotoristaUser` (`@/lib/rbac`), `fileFromForm`/`validateImageFile` (`@/lib/upload-validation`).
- Produces: rota `/motorista/atividades` e a server action `concluirAtividadeAction`.

- [ ] **Step 1: Server action — `_actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMotoristaUser } from "@/lib/rbac";
import { concluirAtividade, listAtividadesPendentesPorMotorista } from "@/lib/repos/atividades-manutencao";
import { uploadAtividadeImage } from "@/lib/repos/atividades-media";
import { existsChecklistHojeParaFrota } from "@/lib/repos/checklists";
import { requiresChecklistDoDia, requiresFotoNaConclusao } from "@/lib/atividades/rules";
import { fileFromForm } from "@/lib/upload-validation";
import { publicActionError } from "@/lib/public-error";

export type ConcluirAtividadeActionState = {
  error: string | null;
  attempt: number;
};

export async function concluirAtividadeAction(
  previousState: ConcluirAtividadeActionState,
  formData: FormData
): Promise<ConcluirAtividadeActionState> {
  const user = await requireMotoristaUser();

  try {
    const atividadeId = z.coerce.number().int().positive().parse(formData.get("atividade_id"));
    const pendentes = await listAtividadesPendentesPorMotorista(user.email);
    const atividade = pendentes.find((a) => a.id === atividadeId);
    if (!atividade) throw new Error("Atividade não encontrada ou já concluída.");

    if (requiresChecklistDoDia(atividade.tipo)) {
      const temChecklist = await existsChecklistHojeParaFrota(user.email, atividade.frota_id);
      if (!temChecklist) {
        throw new Error(`Faça o checklist da frota ${atividade.frota_codigo} antes de concluir esta atividade.`);
      }
    }

    const foto = fileFromForm(formData.get("foto"));
    if (requiresFotoNaConclusao(atividade.tipo) && !foto) {
      throw new Error("Anexe uma foto de chegada para concluir esta atividade.");
    }

    const fotoPath = foto ? await uploadAtividadeImage(foto, { atividadeId }) : null;
    await concluirAtividade(atividadeId, { fotoPath });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: "Atividade inválida.", attempt: previousState.attempt + 1 };
    }
    return { error: publicActionError(error, "Não foi possível concluir a atividade."), attempt: previousState.attempt + 1 };
  }

  revalidatePath("/motorista/atividades");
  revalidatePath("/motorista");
  return { error: null, attempt: previousState.attempt + 1 };
}
```

- [ ] **Step 2: Formulário de conclusão — `components/motorista/concluir-atividade-form.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Camera, Check } from "lucide-react";
import type { ConcluirAtividadeActionState } from "@/app/(app)/motorista/atividades/_actions";
import { Button } from "@/components/ui/button";

const INITIAL_STATE: ConcluirAtividadeActionState = { error: null, attempt: 0 };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Check className="h-4 w-4" aria-hidden="true" />
      {pending ? "Concluindo..." : "Concluir"}
    </Button>
  );
}

export function ConcluirAtividadeForm({
  atividadeId,
  exigeFoto,
  action,
}: {
  atividadeId: number;
  exigeFoto: boolean;
  action: (state: ConcluirAtividadeActionState, formData: FormData) => Promise<ConcluirAtividadeActionState>;
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form key={state.attempt} action={formAction} className="space-y-2">
      <input type="hidden" name="atividade_id" value={atividadeId} />
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">
        <Camera className="h-4 w-4" aria-hidden="true" />
        {exigeFoto ? "Foto de chegada (obrigatória)" : "Foto (opcional)"}
        <input type="file" name="foto" accept="image/*" capture="environment" className="hidden" required={exigeFoto} />
      </label>
      {state.error ? <p className="text-xs font-medium text-red-700">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 3: Página — `page.tsx`**

```tsx
import { ClipboardList } from "lucide-react";
import { ConcluirAtividadeForm } from "@/components/motorista/concluir-atividade-form";
import { Badge } from "@/components/ui/badge";
import { requireMotoristaUser } from "@/lib/rbac";
import { listAtividadesPendentesPorMotorista, listAtividadesRecentesPorMotorista } from "@/lib/repos/atividades-manutencao";
import { formatDuracao, requiresFotoNaConclusao, TIPO_ATIVIDADE_LABELS } from "@/lib/atividades/rules";
import { formatDate } from "@/lib/utils";
import { concluirAtividadeAction } from "./_actions";

export const dynamic = "force-dynamic";

export default async function AtividadesMotoristaPage() {
  const user = await requireMotoristaUser();
  const [pendentes, recentes] = await Promise.all([
    listAtividadesPendentesPorMotorista(user.email),
    listAtividadesRecentesPorMotorista(user.email, 10),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Motorista</p>
        <h1 className="text-3xl font-semibold tracking-tight">Minhas atividades</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pendentes</h2>
        {pendentes.length === 0 ? (
          <div className="rounded-md border bg-white p-6 text-sm text-muted-foreground">
            Nenhuma atividade pendente no momento.
          </div>
        ) : (
          pendentes.map((atividade) => (
            <article key={atividade.id} className="rounded-md border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Frota {atividade.frota_codigo}</h3>
                  <p className="text-sm text-muted-foreground">
                    {TIPO_ATIVIDADE_LABELS[atividade.tipo]} {atividade.local}
                  </p>
                  {atividade.observacao ? (
                    <p className="mt-1 text-xs text-slate-500">{atividade.observacao}</p>
                  ) : null}
                </div>
                <ConcluirAtividadeForm
                  atividadeId={atividade.id}
                  exigeFoto={requiresFotoNaConclusao(atividade.tipo)}
                  action={concluirAtividadeAction}
                />
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Concluídas recentemente</h2>
        {recentes.length === 0 ? (
          <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground">
            Nenhuma atividade concluída ainda.
          </div>
        ) : (
          recentes.map((atividade) => (
            <div key={atividade.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-white p-3 shadow-sm">
              <div>
                <span className="font-medium">Frota {atividade.frota_codigo}</span>{" "}
                <span className="text-sm text-muted-foreground">
                  {TIPO_ATIVIDADE_LABELS[atividade.tipo]} {atividade.local} · {formatDate(atividade.concluido_em)}
                </span>
              </div>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                {atividade.tipo === "LEVAR_PARA" && atividade.concluido_em
                  ? formatDuracao(atividade.criado_em, atividade.concluido_em)
                  : "Concluída"}
              </Badge>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 5: Testar manualmente**

Com o motorista interno de teste: abrir `/motorista/atividades`, ver a atividade `OUTRO` criada na Task 7 como pendente, concluir sem foto (deve funcionar, foto opcional). Depois, na tela de manutenção, criar uma `LEVAR_PARA` pro mesmo motorista numa frota sem checklist hoje; tentar concluir sem checklist deve mostrar o erro "Faça o checklist da frota X..."; tentar concluir sem foto deve mostrar "Anexe uma foto..."; fazer o checklist da frota e anexar foto deve concluir com sucesso e mostrar o tempo calculado na lista de concluídas.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/motorista/atividades" components/motorista/concluir-atividade-form.tsx
git commit -m "feat: conclusão de atividades pelo motorista interno"
```

---

## Task 10: Home do motorista interno

**Files:**
- Modify: `app/(app)/motorista/page.tsx`

**Interfaces:**
- Consumes: `listAtividadesPendentesPorMotorista` (`@/lib/repos/atividades-manutencao`).
- Produces: card "Atividades pendentes" no lugar de "Sua frota atual" quando `user.perfil === "MOTORISTA_INTERNO"`.

- [ ] **Step 1: Ramificar a home por perfil**

Em `app/(app)/motorista/page.tsx`, trocar a leitura de frota fixa por atividades pendentes quando o perfil for `MOTORISTA_INTERNO`, mantendo o restante da página (histórico de checklists) igual:

```tsx
import Link from "next/link";
import { AlertTriangle, ClipboardCheck, ClipboardList, Fuel, History, Home, ShieldAlert, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listDriverChecklists } from "@/lib/repos/checklists";
import { listFrotas } from "@/lib/repos/frotas";
import { listAtividadesPendentesPorMotorista } from "@/lib/repos/atividades-manutencao";
import { requireAppUser } from "@/lib/rbac";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MotoristaHomePage() {
  const user = await requireAppUser();
  const isInterno = user.perfil === "MOTORISTA_INTERNO";

  const [{ rows: frotas }, ultimos, atividadesPendentes] = await Promise.all([
    isInterno ? Promise.resolve({ rows: [] }) : listFrotas({ pageSize: 1 }),
    listDriverChecklists(user.email, 5),
    isInterno ? listAtividadesPendentesPorMotorista(user.email) : Promise.resolve([]),
  ]);
  const frota = frotas[0] ?? null;
  const fezChecklistHoje = ultimos.some((checklist) => formatDate(checklist.data_checklist) === formatDate(new Date()));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        eyebrow={`Hoje · ${formatDate(new Date())}`}
        title={`Bem-vindo, ${user.name}`}
        description={
          isInterno
            ? `${atividadesPendentes.length} atividade(s) pendente(s).`
            : fezChecklistHoje ? "Checklist do dia já registrado." : "Registre o checklist antes de iniciar o uso da frota."
        }
        icon={Home}
        severity={isInterno ? (atividadesPendentes.length > 0 ? "ATENCAO" : "OK") : fezChecklistHoje ? "OK" : "ATENCAO"}
      />

      {isInterno ? (
        <Card className="rounded-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="h-5 w-5 text-blue-700" aria-hidden="true" />
              Atividades pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {atividadesPendentes.length > 0 ? (
              <div className="space-y-2">
                <p className="text-3xl font-bold tabular-nums">{atividadesPendentes.length}</p>
                <Button asChild size="lg" className="h-12">
                  <Link href="/motorista/atividades">
                    <ClipboardList className="h-4 w-4" aria-hidden="true" />
                    Ver atividades
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma atividade pendente no momento.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {!fezChecklistHoje ? (
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <AlertTriangle className="mt-0.5 h-5 w-5" aria-hidden="true" />
              <div className="text-sm">
                <div className="font-semibold">Checklist do dia pendente</div>
                <p>Registre a vistoria antes de iniciar o uso da frota.</p>
              </div>
            </div>
          ) : null}

          <Card className="rounded-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Truck className="h-5 w-5 text-blue-700" aria-hidden="true" />
                Sua frota atual
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1fr_220px]">
              {frota ? (
                <>
                  <Link href="/motorista/checklist" className="rounded-md border bg-slate-50 p-4 transition-colors hover:bg-blue-50">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold">{frota.frota_geral ?? `Frota #${frota.id}`}</h2>
                      <Badge variant="outline">{frota.status ?? "disponível"}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <Info label="Modelo" value={frota.modelo} />
                      <Info label="Placa" value={frota.placa} />
                      <Info label="Localização" value={frota.localizacao} />
                      <Info label="Setor" value={frota.setor} />
                      <Info label="Último KM" value={formatNumber(frota.km_atual)} />
                    </div>
                  </Link>
                  <div className="flex flex-col gap-2">
                    <Button asChild size="lg" className="h-12">
                      <Link href="/motorista/checklist">
                        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                        Fazer checklist agora
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/motorista/checklists">
                        <History className="h-4 w-4" aria-hidden="true" />
                        Meus últimos checklists
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/motorista/sinistro">
                        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                        Reportar sinistro
                      </Link>
                    </Button>
                    <span title="Abastecimento registrado diretamente no checklist" className="cursor-not-allowed">
                      <Button variant="outline" disabled className="pointer-events-none w-full">
                        <Fuel className="h-4 w-4" aria-hidden="true" />
                        Registrar abastecimento
                      </Button>
                    </span>
                  </div>
                </>
              ) : (
                <div className="md:col-span-2 space-y-1 rounded-md border bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">Nenhuma frota atribuída</p>
                  <p className="text-xs text-muted-foreground">Você ainda não tem uma frota designada. Aguarde a atribuição pelo administrador ou entre em contato com a equipe de operação.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico rápido</h2>
        <div className="grid gap-3">
          {ultimos.length > 0 ? (
            ultimos.map((checklist) => (
              <Link
                key={checklist.id}
                href="/motorista/checklists"
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-white p-3 shadow-sm hover:bg-blue-50"
              >
                <div>
                  <div className="font-medium">
                    {formatDate(checklist.data_checklist)} - {checklist.frota_geral ?? checklist.placa ?? "Frota"}
                  </div>
                  <div className="text-sm text-muted-foreground">KM {formatNumber(checklist.km_informado)}</div>
                </div>
                <Badge variant="outline">{checklist.status_geral}</Badge>
              </Link>
            ))
          ) : (
            <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground">Nenhum checklist registrado.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="block text-xs uppercase text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "-"}</span>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Testar manualmente**

Abrir `/motorista` como `MOTORISTA_INTERNO`: deve mostrar o card "Atividades pendentes" (não "Sua frota atual") e o histórico de checklists abaixo continua funcionando. Abrir `/motorista` como `MOTORISTA` comum: comportamento idêntico ao de antes da mudança.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/motorista/page.tsx"
git commit -m "feat: home do motorista interno mostra atividades pendentes"
```

---

## Task 11: Regressão final

**Files:** nenhum arquivo novo — só validação.

- [ ] **Step 1: Rodar a suíte de testes inteira**

Run: `npx vitest run`
Expected: PASS em todos os arquivos, incluindo os novos (`lib/rbac.test.ts`, `lib/atividades/rules.test.ts`, `lib/repos/checklists.test.ts`).

- [ ] **Step 2: Typecheck completo**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Rodar os advisories de segurança do Supabase de novo**

Usar `mcp__claude_ai_Supabase__get_advisors` com `project_id: "nwoqastjgkgsifmxdqwp"` e `type: "security"`.
Expected: nenhum alerta novo além do que já existia antes deste plano.

- [ ] **Step 4: Fluxo ponta a ponta manual**

Repetir o roteiro completo descrito na spec: manutenção cria `LEVAR_PARA` → aparece pendente pro motorista interno → tentativa de concluir sem checklist é bloqueada → motorista faz o checklist da frota → concluir passa a pedir foto → depois de anexar a foto, a atividade sai de pendentes e aparece em concluídas com o tempo calculado.
