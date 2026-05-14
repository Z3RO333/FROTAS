# Plataforma Unificada de Gestão de Frotas — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar gestao-pneus e consulta-documentos-frota ao FROTAS como módulos nativos, com schema consolidado no Supabase `nwoqastjgkgsifmxdqwp` e autenticação 100% via Microsoft/Auth.js.

**Architecture:** Supabase novo projeto como banco dos módulos migrados; Databricks permanece para FROTAS/Checklist/Portaria. Acesso ao Supabase exclusivamente via service role key server-side. RBAC existente em `lib/rbac.ts` controla acesso a cada módulo.

**Tech Stack:** Next.js 16 App Router, TypeScript, `@supabase/supabase-js` ^2.77.0, Tailwind CSS, shadcn/ui, Auth.js v5 (Microsoft Entra ID já provisionado).

**Spec:** `docs/superpowers/specs/2026-05-13-plataforma-unificada-design.md`

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `lib/supabase-manutencao.ts` | Criar | Cliente Supabase server-side (service role) |
| `lib/repos/manutencao/types.ts` | Criar | Tipos compartilhados de todos os módulos |
| `lib/repos/manutencao/documents.ts` | Criar | CRUD documentos (DUT/CRLV) |
| `lib/repos/manutencao/pneus.ts` | Criar | Trocas de pneus, posições, número de fogo |
| `lib/repos/manutencao/servicos.ts` | Criar | Radar de serviços (motor, suspensão, embreagem, AC, lavagem, tacógrafo, portas) |
| `lib/repos/manutencao/equipamentos.ts` | Criar | Equipamentos + preventivas + componentes |
| `lib/repos/manutencao/operacao.ts` | Criar | Demandas + motoristas + localização |
| `lib/repos/manutencao/oficinas.ts` | Criar | Oficinas + registros de serviço |
| `app/(app)/documentos/page.tsx` | Criar | Página documentos (lista + upload) |
| `app/(app)/documentos/_actions.ts` | Criar | Server Actions documentos |
| `app/(app)/pneus/page.tsx` | Criar | Página pneus (lista veículos + troca) |
| `app/(app)/pneus/_actions.ts` | Criar | Server Actions pneus |
| `app/(app)/manutencao/page.tsx` | Criar | Radar de serviços por veículo |
| `app/(app)/manutencao/_actions.ts` | Criar | Server Actions serviços |
| `app/(app)/equipamentos/page.tsx` | Criar | Lista equipamentos + preventivas |
| `app/(app)/equipamentos/_actions.ts` | Criar | Server Actions equipamentos |
| `app/(app)/operacao/page.tsx` | Criar | Demandas de operação |
| `app/(app)/operacao/_actions.ts` | Criar | Server Actions operação |
| `app/(app)/oficinas/page.tsx` | Criar | Lista oficinas |
| `app/(app)/oficinas/_actions.ts` | Criar | Server Actions oficinas |
| `scripts/migrate-supabase-pneus.ts` | Criar | Migra dados do projeto gestao-pneus |
| `scripts/migrate-supabase-docs.ts` | Criar | Migra dados do projeto consulta-documentos |
| `components/app-shell.tsx` | Modificar | Adicionar novos itens de nav com guarda RBAC |
| `lib/rbac.ts` | Modificar | Adicionar helpers de acesso aos novos módulos |
| `package.json` | Modificar | Adicionar `@supabase/supabase-js` |
| `.env` | Modificar | Adicionar vars do Supabase novo projeto |

---

## Task 1: Schema Supabase — Migration SQL

**Files:**
- Create: `supabase/migrations/001_plataforma_unificada.sql`

- [ ] **Step 1: Criar arquivo de migration**

Criar `supabase/migrations/001_plataforma_unificada.sql` com o conteúdo abaixo (schema completo consolidado dos dois projetos de origem):

```sql
-- ============================================================
-- Plataforma Unificada de Gestão de Frotas
-- Supabase projeto: nwoqastjgkgsifmxdqwp
-- Origem: gestao-pneus + consulta-documentos-frota
-- Auth: service_role only (Auth.js/Microsoft no Next.js)
-- ============================================================

-- Bloqueia acesso direto via anon key (helper reutilizado nas policies)
create or replace function public.is_service_role()
returns boolean language sql stable as $$
  select current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
     or auth.role() = 'service_role';
$$;

-- ============================================================
-- MÓDULO: VEÍCULOS / MANUTENÇÃO
-- ============================================================

create table if not exists public.veiculos (
  id             bigserial primary key,
  codigo_frota   text not null unique,
  placa          text,
  modelo         text,
  qtd_pneus      integer not null default 0,
  local          text,
  classificacao_tipo   text,
  classificacao_outro  text,
  equipamento    text,
  -- intervalos de manutenção (configuráveis por veículo)
  intervalo_lavagem_dias        integer default 30,
  intervalo_alinhamento_km      integer default 10000,
  intervalo_suspensao_km        integer default 5000,
  intervalo_arcondicionado_dias integer default 365,
  intervalo_tacografo_dias      integer default 180,
  intervalo_portas_rool_up_dias integer default 60,
  intervalo_embreagem_dias      integer default 365,
  intervalo_motor_km            integer default 20000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Registro-mãe de todos os serviços de manutenção
create table if not exists public.servicos_app (
  id_servico          text primary key default gen_random_uuid()::text,
  id_veiculo          text not null references public.veiculos(codigo_frota) on delete cascade,
  tipo_servico        text not null,
  data_servico        timestamptz not null default now(),
  quilometragem       numeric(12,0),
  observacoes         text,
  registrado_por_id   text,
  registrado_por_email text,
  registrado_por_nome  text,
  created_at          timestamptz not null default now(),
  constraint servicos_app_tipo_ck check (tipo_servico in (
    'troca_pneu','lavagem','alinhamento','balanceamento',
    'tacografo','portas_rool_up','embreagem','motor',
    'km_diario','ar-condicionado','suspensao','bateria'
  ))
);

-- Detalhes específicos de troca de pneus (uma linha por posição)
create table if not exists public.trocas_pneus_app (
  id          bigserial primary key,
  id_servico  text not null references public.servicos_app(id_servico) on delete cascade,
  posicao     text not null,
  numero_fogo text,
  quilometragem numeric(12,0),
  observacoes text,
  created_at  timestamptz not null default now()
);

-- Detalhes de alinhamento/balanceamento
create table if not exists public.alinhamentos_app (
  id         bigserial primary key,
  id_servico text not null references public.servicos_app(id_servico) on delete cascade,
  tipo       text not null default 'alinhamento',
  created_at timestamptz not null default now(),
  constraint alinhamentos_app_tipo_ck check (tipo in ('alinhamento','balanceamento'))
);

-- Detalhes de lavagem
create table if not exists public.lavagens_app (
  id         bigserial primary key,
  id_servico text not null references public.servicos_app(id_servico) on delete cascade,
  observacoes text,
  created_at timestamptz not null default now()
);

-- KM base para cálculo de próximo serviço (por veículo e tipo)
create table if not exists public.servicos_km_base_app (
  id          bigserial primary key,
  id_veiculo  text not null references public.veiculos(codigo_frota) on delete cascade,
  tipo_servico text not null,
  km_base     numeric(12,0) not null,
  data_base   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id_veiculo, tipo_servico)
);

-- Número de fogo sequencial dos pneus
create table if not exists public.numero_fogo (
  id                bigserial primary key,
  numero_fogo       text not null,
  contagem          integer not null default 1,
  data              date not null default current_date,
  mes               integer,
  placa             text,
  frota             text,
  ultimo_digito_ano text,
  qtd_pneus         integer,
  created_at        timestamptz not null default now()
);

-- ============================================================
-- MÓDULO: EQUIPAMENTOS
-- ============================================================

create table if not exists public.equipamentos_app (
  id              uuid primary key default gen_random_uuid(),
  equipamento     text not null,
  modelo_marca    text,
  marca           text,
  segmento        text not null,
  ano             integer,
  numero_equip    text not null unique,
  numero_serie    text,
  local           text,
  setor           text,
  horimetro_atual       numeric(12,1),
  horimetro_base_300h   numeric(12,1),
  horimetro_base_1500h  numeric(12,1),
  ativo           boolean not null default true,
  observacoes     text,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now()),
  constraint equipamentos_app_segmento_ck check (
    segmento in ('EMPILHADEIRA','SELECIONADORA','PALETEIRA')
  )
);

create table if not exists public.equipamentos_preventivas_app (
  id               uuid primary key default gen_random_uuid(),
  equipamento_id   uuid not null references public.equipamentos_app(id) on delete cascade,
  tipo_preventiva  text not null,
  data_servico     date not null,
  horimetro_servico numeric(12,1) not null,
  observacoes      text,
  detalhes         jsonb,
  registrado_por_id    text,
  registrado_por_email text,
  registrado_por_nome  text,
  created_at       timestamptz not null default timezone('utc', now()),
  constraint equipamentos_preventivas_app_tipo_ck check (
    tipo_preventiva in ('300h','1500h')
  )
);

create table if not exists public.equipamentos_componentes_app (
  id               uuid primary key default gen_random_uuid(),
  equipamento_id   uuid not null references public.equipamentos_app(id) on delete cascade,
  tipo_componente  text not null,
  codigo_produto   text,
  numero_componente text not null,
  numero_serie     text,
  modelo_marca     text,
  marca            text,
  ano              integer,
  observacoes      text,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now()),
  constraint equipamentos_componentes_app_tipo_ck check (
    tipo_componente in ('CARREGADOR','BATERIA')
  ),
  unique (equipamento_id, tipo_componente, numero_componente)
);

-- ============================================================
-- MÓDULO: OPERAÇÃO
-- ============================================================

create table if not exists public.operacao_motoristas_app (
  id                    bigserial primary key,
  auth_user_id          uuid unique,
  email                 text not null unique,
  nome                  text,
  identificacao         text not null unique,
  foto_url              text,
  disponibilidade_entrada time,
  disponibilidade_saida   time,
  ativo                 boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.operacao_permissoes_app (
  id           bigserial primary key,
  auth_user_id uuid unique,
  email        text not null unique,
  nome         text,
  is_admin     boolean not null default false,
  is_motorista boolean not null default true,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.operacao_demandas_app (
  id                     uuid primary key default gen_random_uuid(),
  status                 text not null default 'disponivel',
  descricao              text not null,
  servico_tipo           text,
  tipo_movimentacao      text not null default 'levar_frota',
  origem_local           text,
  origem_lat             double precision,
  origem_lng             double precision,
  deslocamento_tipo      text default 'frota',
  deslocamento_detalhes  text,
  uber_utilizado         boolean not null default false,
  uber_registrado_em     timestamptz,
  id_veiculo             text,
  destino                text,
  destino_lat            double precision,
  destino_lng            double precision,
  rota_distancia_km      double precision,
  rota_duracao_min       integer,
  rota_atualizada_em     timestamptz,
  prioridade             text not null default 'normal',
  data_prevista          date,
  criado_por_id          text,
  criado_por_email       text,
  criado_por_nome        text,
  motorista_auth_user_id uuid,
  motorista_email        text,
  motorista_nome         text,
  motorista_identificacao text,
  assigned_at            timestamptz,
  assigned_by            text,
  assigned_rule          text,
  frota_deslocamento_id  text,
  retorno_status         text not null default 'nao_aplicavel',
  retorno_pendente       boolean not null default false,
  retorno_alerta_em      timestamptz,
  retorno_registrado_em  timestamptz,
  iniciado_em            timestamptz,
  iniciado_por_id        text,
  iniciado_por_email     text,
  iniciado_por_nome      text,
  concluido_em           timestamptz,
  conclusao_observacoes  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint operacao_demandas_status_ck check (
    status in ('disponivel','em_andamento','concluido','cancelado')
  ),
  constraint operacao_demandas_prioridade_ck check (
    prioridade in ('baixa','normal','alta','urgente')
  ),
  constraint operacao_demandas_tipo_movimentacao_ck check (
    tipo_movimentacao in ('retirada','levar_frota')
  )
);

create table if not exists public.operacao_demandas_adm_app (
  id         bigserial primary key,
  demanda_id uuid not null references public.operacao_demandas_app(id) on delete cascade,
  status     text not null default 'pendente',
  titulo     text not null,
  descricao  text,
  criado_em  timestamptz not null default now(),
  concluido_em timestamptz,
  constraint operacao_demandas_adm_status_ck check (
    status in ('pendente','em_tratativa','concluida')
  )
);

create table if not exists public.operacao_oficinas_app (
  id               bigserial primary key,
  nome             text not null unique,
  categoria        text not null default 'oficina',
  localizacao      text not null,
  localizacao_lat  double precision,
  localizacao_lng  double precision,
  horario_inicio   time,
  horario_fim      time,
  tipos_servico    text[] not null default '{}',
  ativo            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.operacao_oficina_registros_app (
  id             bigserial primary key,
  oficina_id     bigint not null references public.operacao_oficinas_app(id) on delete cascade,
  demanda_id     uuid references public.operacao_demandas_app(id) on delete set null,
  tipo_servico   text not null,
  descricao      text,
  data_servico   timestamptz not null default now(),
  criado_por_id  text,
  criado_por_email text,
  criado_por_nome  text,
  created_at     timestamptz not null default now()
);

create table if not exists public.operacao_motoristas_localizacao_app (
  id           bigserial primary key,
  motorista_id bigint not null references public.operacao_motoristas_app(id) on delete cascade,
  auth_user_id uuid,
  email        text,
  lat          double precision not null,
  lng          double precision not null,
  accuracy_m   double precision,
  capturado_em timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists idx_operacao_motoristas_localizacao_unique
  on public.operacao_motoristas_localizacao_app (motorista_id);

create table if not exists public.operacao_motoristas_localizacao_historico_app (
  id           bigserial primary key,
  demanda_id   uuid references public.operacao_demandas_app(id) on delete set null,
  motorista_id bigint not null references public.operacao_motoristas_app(id) on delete cascade,
  auth_user_id uuid,
  email        text,
  lat          double precision not null,
  lng          double precision not null,
  accuracy_m   double precision,
  capturado_em timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ============================================================
-- MÓDULO: DOCUMENTOS (consulta-documentos-frota)
-- ============================================================

create table if not exists public.documents (
  id         uuid primary key default gen_random_uuid(),
  frota      text not null,
  placa      text not null,
  modelo     text not null,
  dut_url    text not null,
  crlv_url   text not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by text
);

create index if not exists documents_placa_idx  on public.documents (lower(placa));
create index if not exists documents_frota_idx  on public.documents (lower(frota));

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================

create index if not exists idx_servicos_veiculo_data
  on public.servicos_app (id_veiculo, data_servico desc);
create index if not exists idx_servicos_tipo_data
  on public.servicos_app (tipo_servico, data_servico desc);
create index if not exists idx_trocas_servico
  on public.trocas_pneus_app (id_servico);
create index if not exists idx_alinhamentos_servico
  on public.alinhamentos_app (id_servico);
create index if not exists idx_lavagens_servico
  on public.lavagens_app (id_servico);
create index if not exists idx_km_base_veiculo_tipo
  on public.servicos_km_base_app (id_veiculo, tipo_servico);
create index if not exists idx_numero_fogo_placa
  on public.numero_fogo (placa);
create index if not exists idx_numero_fogo_data
  on public.numero_fogo (data desc, contagem desc);
create index if not exists idx_equipamentos_segmento
  on public.equipamentos_app (segmento);
create index if not exists idx_equipamentos_ativo
  on public.equipamentos_app (ativo);
create index if not exists idx_equipamentos_preventivas_tipo_data
  on public.equipamentos_preventivas_app (equipamento_id, tipo_preventiva, data_servico desc);
create index if not exists idx_demandas_status
  on public.operacao_demandas_app (status);
create index if not exists idx_demandas_motorista
  on public.operacao_demandas_app (motorista_email, assigned_at desc);
create index if not exists idx_demandas_created
  on public.operacao_demandas_app (created_at desc);

-- ============================================================
-- RLS — service_role only em todas as tabelas
-- ============================================================

do $$ declare
  t text;
begin
  foreach t in array array[
    'veiculos','servicos_app','trocas_pneus_app','alinhamentos_app',
    'lavagens_app','servicos_km_base_app','numero_fogo',
    'equipamentos_app','equipamentos_preventivas_app','equipamentos_componentes_app',
    'operacao_motoristas_app','operacao_permissoes_app','operacao_demandas_app',
    'operacao_demandas_adm_app','operacao_oficinas_app','operacao_oficina_registros_app',
    'operacao_motoristas_localizacao_app','operacao_motoristas_localizacao_historico_app',
    'documents'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "service_role_only" on public.%I using (public.is_service_role())',
      t
    );
  end loop;
end $$;

-- ============================================================
-- STORAGE: bucket documents (privado)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "service_role_documents_all"
  on storage.objects
  for all
  using (bucket_id = 'documents' and public.is_service_role());

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_veiculos_updated_at
  before update on public.veiculos
  for each row execute function public.set_updated_at();

create trigger trg_servicos_km_base_updated_at
  before update on public.servicos_km_base_app
  for each row execute function public.set_updated_at();

create trigger trg_equipamentos_updated_at
  before update on public.equipamentos_app
  for each row execute function public.set_updated_at();

create trigger trg_equipamentos_componentes_updated_at
  before update on public.equipamentos_componentes_app
  for each row execute function public.set_updated_at();

create trigger trg_operacao_motoristas_updated_at
  before update on public.operacao_motoristas_app
  for each row execute function public.set_updated_at();

create trigger trg_operacao_permissoes_updated_at
  before update on public.operacao_permissoes_app
  for each row execute function public.set_updated_at();

create trigger trg_operacao_demandas_updated_at
  before update on public.operacao_demandas_app
  for each row execute function public.set_updated_at();

create trigger trg_operacao_oficinas_updated_at
  before update on public.operacao_oficinas_app
  for each row execute function public.set_updated_at();

create trigger trg_operacao_localizacao_updated_at
  before update on public.operacao_motoristas_localizacao_app
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Aplicar migration via MCP Supabase**

Usar a ferramenta `mcp__claude_ai_Supabase__apply_migration` com `project_id: nwoqastjgkgsifmxdqwp` e o SQL acima.

- [ ] **Step 3: Verificar tabelas criadas**

Usar `mcp__claude_ai_Supabase__list_tables` com `project_id: nwoqastjgkgsifmxdqwp` e confirmar que retorna as 19 tabelas + bucket `documents`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_plataforma_unificada.sql
git commit -m "feat: schema consolidado Supabase plataforma unificada"
```

---

## Task 2: Dependência e cliente Supabase no FROTAS

**Files:**
- Modify: `package.json`
- Create: `lib/supabase-manutencao.ts`
- Modify: `.env`

- [ ] **Step 1: Instalar @supabase/supabase-js**

```bash
npm install @supabase/supabase-js@^2.77.0
```

Verificar que aparece em `dependencies` no `package.json`.

- [ ] **Step 2: Criar `lib/supabase-manutencao.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_MANUTENCAO_URL;
const key = process.env.SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("SUPABASE_MANUTENCAO_URL e SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY são obrigatórios");
}

export const supabaseManutencao = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

- [ ] **Step 3: Adicionar vars no `.env`**

Abrir `.env` e adicionar ao final (substituir pelos valores reais do projeto `nwoqastjgkgsifmxdqwp`):

```
SUPABASE_MANUTENCAO_URL=https://nwoqastjgkgsifmxdqwp.supabase.co
SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY=<service_role_key_do_projeto_novo>
NEXT_PUBLIC_SUPABASE_MANUTENCAO_ANON_KEY=<anon_key_do_projeto_novo>
```

> Para obter as chaves: Dashboard Supabase → projeto `nwoqastjgkgsifmxdqwp` → Settings → API.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase-manutencao.ts package.json package-lock.json
git commit -m "feat: cliente Supabase manutenção (service role server-side)"
```

---

## Task 3: Scripts de migração de dados

**Files:**
- Create: `scripts/migrate-supabase-pneus.ts`
- Create: `scripts/migrate-supabase-docs.ts`

- [ ] **Step 1: Criar `scripts/migrate-supabase-pneus.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

// Origem: projeto gestao-pneus (olqngohdioglrxqalffh)
const origem = createClient(
  "https://olqngohdioglrxqalffh.supabase.co",
  process.env.SUPABASE_PNEUS_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Destino: projeto novo (nwoqastjgkgsifmxdqwp)
const destino = createClient(
  process.env.SUPABASE_MANUTENCAO_URL!,
  process.env.SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const PAGE = 1000;

async function migrarTabela(nomeTabela: string, colunas = "*") {
  console.log(`\n→ Migrando ${nomeTabela}...`);
  let offset = 0;
  let total = 0;

  while (true) {
    const { data, error } = await origem
      .from(nomeTabela)
      .select(colunas)
      .range(offset, offset + PAGE - 1);

    if (error) { console.error(`  Erro ao ler ${nomeTabela}:`, error.message); break; }
    if (!data || data.length === 0) break;

    const { error: errInsert } = await destino
      .from(nomeTabela)
      .upsert(data, { onConflict: "id" });

    if (errInsert) {
      console.error(`  Erro ao inserir em ${nomeTabela}:`, errInsert.message);
      break;
    }

    total += data.length;
    offset += PAGE;
    console.log(`  ${total} registros migrados...`);
    if (data.length < PAGE) break;
  }

  console.log(`  ✓ ${nomeTabela}: ${total} registros`);
}

async function migrarTabelaComConflito(nomeTabela: string, onConflict: string) {
  console.log(`\n→ Migrando ${nomeTabela}...`);
  let offset = 0;
  let total = 0;

  while (true) {
    const { data, error } = await origem
      .from(nomeTabela)
      .select("*")
      .range(offset, offset + PAGE - 1);

    if (error) { console.error(`  Erro:`, error.message); break; }
    if (!data || data.length === 0) break;

    const { error: errInsert } = await destino
      .from(nomeTabela)
      .upsert(data, { onConflict });

    if (errInsert) {
      console.error(`  Erro ao inserir:`, errInsert.message);
      // Inserir um por um para não perder o lote inteiro
      for (const row of data) {
        const { error: e } = await destino.from(nomeTabela).upsert(row, { onConflict });
        if (e) console.warn(`  Skip row:`, JSON.stringify(row).slice(0, 100), e.message);
        else total++;
      }
      offset += PAGE;
      continue;
    }

    total += data.length;
    offset += PAGE;
    if (data.length < PAGE) break;
  }

  console.log(`  ✓ ${nomeTabela}: ${total} registros`);
}

async function main() {
  console.log("=== Migração gestao-pneus → plataforma unificada ===\n");

  // Ordem importa por causa das FKs
  await migrarTabelaComConflito("veiculos", "codigo_frota");
  await migrarTabela("servicos_app", "*");
  await migrarTabela("trocas_pneus_app", "*");
  await migrarTabela("alinhamentos_app", "*");
  await migrarTabela("lavagens_app", "*");
  await migrarTabelaComConflito("servicos_km_base_app", "id_veiculo,tipo_servico");
  await migrarTabela("numero_fogo", "*");
  await migrarTabela("equipamentos_app", "*");
  await migrarTabela("equipamentos_preventivas_app", "*");
  await migrarTabela("equipamentos_componentes_app", "*");
  await migrarTabela("operacao_motoristas_app", "*");
  await migrarTabela("operacao_permissoes_app", "*");
  await migrarTabela("operacao_demandas_app", "*");
  await migrarTabela("operacao_demandas_adm_app", "*");
  await migrarTabela("operacao_oficinas_app", "*");
  await migrarTabela("operacao_oficina_registros_app", "*");
  await migrarTabela("operacao_motoristas_localizacao_app", "*");
  await migrarTabela("operacao_motoristas_localizacao_historico_app", "*");

  console.log("\n✅ Migração de pneus/manutenção concluída.");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Criar `scripts/migrate-supabase-docs.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const origem = createClient(
  "https://llullmnpyafsdarpwezs.supabase.co",
  process.env.SUPABASE_DOCS_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const destino = createClient(
  process.env.SUPABASE_MANUTENCAO_URL!,
  process.env.SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function main() {
  console.log("=== Migração consulta-documentos → plataforma unificada ===\n");

  // Migrar tabela documents
  console.log("→ Migrando documents...");
  let offset = 0;
  let total = 0;

  while (true) {
    const { data, error } = await origem
      .from("documents")
      .select("id,frota,placa,modelo,dut_url,crlv_url,created_at")
      .range(offset, offset + 999);

    if (error) { console.error("Erro:", error.message); break; }
    if (!data || data.length === 0) break;

    // created_by era uuid ref para auth.users — descartamos na migração
    const rows = data.map((d) => ({ ...d, created_by: null }));
    const { error: ei } = await destino.from("documents").upsert(rows, { onConflict: "id" });
    if (ei) { console.error("Erro insert:", ei.message); break; }

    total += data.length;
    offset += 1000;
    if (data.length < 1000) break;
  }

  console.log(`  ✓ documents: ${total} registros`);
  console.log("\n⚠️  Arquivos do Storage (DUT/CRLV) precisam ser migrados manualmente.");
  console.log("   Baixar do bucket 'documents' em llullmnpyafsdarpwezs");
  console.log("   e re-upload para o bucket 'documents' em nwoqastjgkgsifmxdqwp");

  console.log("\n✅ Migração de documentos concluída.");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Adicionar keys de origem no `.env` e executar**

Adicionar em `.env`:
```
SUPABASE_PNEUS_SERVICE_ROLE_KEY=<service_role_do_projeto_olqngohdioglrxqalffh>
SUPABASE_DOCS_SERVICE_ROLE_KEY=<service_role_do_projeto_llullmnpyafsdarpwezs>
```

```bash
npx tsx scripts/migrate-supabase-pneus.ts
npx tsx scripts/migrate-supabase-docs.ts
```

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-supabase-pneus.ts scripts/migrate-supabase-docs.ts
git commit -m "feat: scripts de migração dados gestao-pneus e consulta-documentos"
```

---

## Task 4: Tipos compartilhados e RBAC

**Files:**
- Create: `lib/repos/manutencao/types.ts`
- Modify: `lib/rbac.ts`

- [ ] **Step 1: Criar `lib/repos/manutencao/types.ts`**

```typescript
export type TipoServico =
  | "troca_pneu" | "lavagem" | "alinhamento" | "balanceamento"
  | "tacografo" | "portas_rool_up" | "embreagem" | "motor"
  | "km_diario" | "ar-condicionado" | "suspensao" | "bateria";

export type SegmentoEquipamento = "EMPILHADEIRA" | "SELECIONADORA" | "PALETEIRA";
export type TipoComponente = "CARREGADOR" | "BATERIA";
export type TipoPreventiva = "300h" | "1500h";
export type StatusDemanda = "disponivel" | "em_andamento" | "concluido" | "cancelado";
export type PrioridadeDemanda = "baixa" | "normal" | "alta" | "urgente";

export interface Veiculo {
  id: number;
  codigo_frota: string;
  placa: string | null;
  modelo: string | null;
  qtd_pneus: number;
  local: string | null;
  classificacao_tipo: string | null;
  equipamento: string | null;
  intervalo_lavagem_dias: number;
  intervalo_alinhamento_km: number;
  intervalo_suspensao_km: number;
  intervalo_arcondicionado_dias: number;
  intervalo_tacografo_dias: number;
  intervalo_portas_rool_up_dias: number;
  intervalo_embreagem_dias: number;
  intervalo_motor_km: number;
  created_at: string;
  updated_at: string;
}

export interface ServicoApp {
  id_servico: string;
  id_veiculo: string;
  tipo_servico: TipoServico;
  data_servico: string;
  quilometragem: number | null;
  observacoes: string | null;
  registrado_por_email: string | null;
  registrado_por_nome: string | null;
  created_at: string;
}

export interface TrocaPneuApp {
  id: number;
  id_servico: string;
  posicao: string;
  numero_fogo: string | null;
  quilometragem: number | null;
  observacoes: string | null;
}

export interface NumeroFogo {
  id: number;
  numero_fogo: string;
  contagem: number;
  data: string;
  placa: string | null;
  frota: string | null;
  qtd_pneus: number | null;
}

export interface EquipamentoApp {
  id: string;
  equipamento: string;
  modelo_marca: string | null;
  segmento: SegmentoEquipamento;
  numero_equip: string;
  local: string | null;
  setor: string | null;
  horimetro_atual: number | null;
  ativo: boolean;
}

export interface DocumentRecord {
  id: string;
  frota: string;
  placa: string;
  modelo: string;
  dut_url: string;
  crlv_url: string;
  created_at: string;
  created_by: string | null;
}

export interface DemandaApp {
  id: string;
  status: StatusDemanda;
  descricao: string;
  tipo_movimentacao: string;
  prioridade: PrioridadeDemanda;
  motorista_nome: string | null;
  motorista_email: string | null;
  id_veiculo: string | null;
  destino: string | null;
  concluido_em: string | null;
  created_at: string;
}

export interface OficinasApp {
  id: number;
  nome: string;
  categoria: string;
  localizacao: string;
  localizacao_lat: number | null;
  localizacao_lng: number | null;
  tipos_servico: string[];
  ativo: boolean;
}
```

- [ ] **Step 2: Atualizar `lib/rbac.ts`**

Adicionar após as funções `canAccess*` existentes:

```typescript
export function canAccessManutencao(perfil: PerfilUsuario): boolean {
  return perfil === "ADMIN" || perfil === "GESTOR" || perfil === "MANUTENCAO" || perfil === "DEV";
}

export function canAccessOperacao(perfil: PerfilUsuario): boolean {
  return perfil === "ADMIN" || perfil === "GESTOR" || perfil === "PORTARIA" || perfil === "DEV";
}

export function canAccessDocumentos(perfil: PerfilUsuario): boolean {
  return perfil !== "MOTORISTA";
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/repos/manutencao/types.ts lib/rbac.ts
git commit -m "feat: tipos compartilhados e RBAC para módulos de manutenção"
```

---

## Task 5: Módulo /documentos

**Files:**
- Create: `lib/repos/manutencao/documents.ts`
- Create: `app/(app)/documentos/page.tsx`
- Create: `app/(app)/documentos/_actions.ts`

- [ ] **Step 1: Criar `lib/repos/manutencao/documents.ts`**

```typescript
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { DocumentRecord } from "./types";

const T = "documents";

export interface ListDocumentsFilters {
  frota?: string;
  placa?: string;
  page?: number;
  pageSize?: number;
}

export async function listDocuments(
  filters: ListDocumentsFilters = {}
): Promise<{ rows: DocumentRecord[]; total: number }> {
  const { frota, placa, page = 1, pageSize = 25 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabaseManutencao.from(T).select("*", { count: "exact" });

  if (frota) q = q.ilike("frota", `%${frota}%`);
  if (placa) q = q.ilike("placa", `%${placa}%`);

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`listDocuments: ${error.message}`);
  return { rows: (data ?? []) as DocumentRecord[], total: count ?? 0 };
}

export async function createDocument(
  input: Omit<DocumentRecord, "id" | "created_at">,
  createdBy: string
): Promise<DocumentRecord> {
  const { data, error } = await supabaseManutencao
    .from(T)
    .insert({ ...input, created_by: createdBy })
    .select()
    .single();

  if (error) throw new Error(`createDocument: ${error.message}`);
  return data as DocumentRecord;
}

export async function updateDocument(
  id: string,
  input: Partial<Pick<DocumentRecord, "frota" | "placa" | "modelo" | "dut_url" | "crlv_url">>
): Promise<void> {
  const { error } = await supabaseManutencao.from(T).update(input).eq("id", id);
  if (error) throw new Error(`updateDocument: ${error.message}`);
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabaseManutencao.from(T).delete().eq("id", id);
  if (error) throw new Error(`deleteDocument: ${error.message}`);
}

export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabaseManutencao.storage
    .from("documents")
    .createSignedUrl(path, 3600);
  if (error) throw new Error(`getSignedUrl: ${error.message}`);
  return data.signedUrl;
}

export async function uploadDocument(
  path: string,
  file: Buffer,
  contentType: string
): Promise<string> {
  const { error } = await supabaseManutencao.storage
    .from("documents")
    .upload(path, file, { contentType, upsert: true });
  if (error) throw new Error(`uploadDocument: ${error.message}`);
  return path;
}
```

- [ ] **Step 2: Criar `app/(app)/documentos/_actions.ts`**

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/rbac";
import { canAccessDocumentos } from "@/lib/rbac";
import { createDocument, updateDocument, deleteDocument } from "@/lib/repos/manutencao/documents";
import { redirect } from "next/navigation";

const DocumentSchema = z.object({
  frota: z.string().min(1, "Frota obrigatória"),
  placa: z.string().min(1, "Placa obrigatória"),
  modelo: z.string().min(1, "Modelo obrigatório"),
  dut_url: z.string().url("URL DUT inválida"),
  crlv_url: z.string().url("URL CRLV inválida"),
});

export async function createDocumentAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canAccessDocumentos(user.perfil)) redirect("/");

  const input = DocumentSchema.parse(Object.fromEntries(formData));
  await createDocument(input, user.email);
  revalidatePath("/documentos");
}

export async function updateDocumentAction(id: string, formData: FormData) {
  const user = await requireAppUser();
  if (!canAccessDocumentos(user.perfil)) redirect("/");

  const input = DocumentSchema.partial().parse(Object.fromEntries(formData));
  await updateDocument(id, input);
  revalidatePath("/documentos");
}

export async function deleteDocumentAction(id: string) {
  const user = await requireAppUser();
  if (!canAccessDocumentos(user.perfil)) redirect("/");

  await deleteDocument(id);
  revalidatePath("/documentos");
}
```

- [ ] **Step 3: Criar `app/(app)/documentos/page.tsx`**

```typescript
import { FileText, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAppUser, canAccessDocumentos } from "@/lib/rbac";
import { listDocuments } from "@/lib/repos/manutencao/documents";
import { redirect } from "next/navigation";
import type { DocumentRecord } from "@/lib/repos/manutencao/types";

export const dynamic = "force-dynamic";

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAppUser();
  if (!canAccessDocumentos(user.perfil)) redirect("/");

  const sp = await searchParams;
  const { rows, total } = await listDocuments({
    frota: sp.frota,
    placa: sp.placa,
    page: sp.page ? Number(sp.page) : 1,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Documentos</p>
          <h1 className="text-3xl font-semibold tracking-tight">Documentos da frota</h1>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Novo documento
        </Button>
      </div>

      <form className="grid gap-2 rounded-md border bg-white p-3 shadow-sm sm:grid-cols-[1fr_1fr_auto]">
        <Input name="frota" defaultValue={sp.frota ?? ""} placeholder="Número da frota" />
        <Input name="placa" defaultValue={sp.placa ?? ""} placeholder="Placa" />
        <Button type="submit">
          <Search className="h-4 w-4" />
          Buscar
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">{total} documento{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}</p>

      <section className="overflow-hidden rounded-md border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Frota</th>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">DUT</th>
                <th className="px-4 py-3">CRLV</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum documento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DocumentRow({ doc }: { doc: DocumentRecord }) {
  return (
    <tr className="border-t">
      <td className="px-4 py-3 font-medium">{doc.frota}</td>
      <td className="px-4 py-3">{doc.placa}</td>
      <td className="px-4 py-3">{doc.modelo}</td>
      <td className="px-4 py-3">
        <a href={doc.dut_url} target="_blank" rel="noopener noreferrer">
          <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-slate-50">
            <FileText className="h-3 w-3" /> DUT
          </Badge>
        </a>
      </td>
      <td className="px-4 py-3">
        <a href={doc.crlv_url} target="_blank" rel="noopener noreferrer">
          <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-slate-50">
            <FileText className="h-3 w-3" /> CRLV
          </Badge>
        </a>
      </td>
      <td className="px-4 py-3 text-right">
        <Button variant="ghost" size="sm">Editar</Button>
      </td>
    </tr>
  );
}
```

- [ ] **Step 4: Testar no browser**

```bash
npm run dev
```

Abrir `http://localhost:3000/documentos`. Confirmar que a página carrega sem erros de TypeScript/runtime.

- [ ] **Step 5: Commit**

```bash
git add lib/repos/manutencao/documents.ts app/(app)/documentos/
git commit -m "feat: módulo /documentos (DUT/CRLV por frota)"
```

---

## Task 6: Módulo /pneus

**Files:**
- Create: `lib/repos/manutencao/pneus.ts`
- Create: `app/(app)/pneus/page.tsx`
- Create: `app/(app)/pneus/_actions.ts`

- [ ] **Step 1: Criar `lib/repos/manutencao/pneus.ts`**

```typescript
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { Veiculo, ServicoApp, TrocaPneuApp, NumeroFogo } from "./types";
import { randomUUID } from "crypto";

export async function listVeiculos(search?: string): Promise<Veiculo[]> {
  let q = supabaseManutencao
    .from("veiculos")
    .select("*")
    .order("codigo_frota");

  if (search) {
    const s = `%${search.toLowerCase()}%`;
    q = q.or(`codigo_frota.ilike.${s},placa.ilike.${s},modelo.ilike.${s}`);
  }

  const { data, error } = await q;
  if (error) throw new Error(`listVeiculos: ${error.message}`);
  return (data ?? []) as Veiculo[];
}

export async function getVeiculo(codigoFrota: string): Promise<Veiculo | null> {
  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select("*")
    .eq("codigo_frota", codigoFrota)
    .single();

  if (error && error.code !== "PGRST116") throw new Error(`getVeiculo: ${error.message}`);
  return (data ?? null) as Veiculo | null;
}

export interface TrocaPneuInput {
  id_veiculo: string;
  quilometragem: number;
  observacoes?: string;
  posicoes: Array<{ posicao: string; numero_fogo?: string }>;
  registrado_por_email: string;
  registrado_por_nome: string;
}

export async function registrarTrocaPneu(input: TrocaPneuInput): Promise<string> {
  const idServico = randomUUID();

  const { error: errServico } = await supabaseManutencao
    .from("servicos_app")
    .insert({
      id_servico: idServico,
      id_veiculo: input.id_veiculo,
      tipo_servico: "troca_pneu",
      quilometragem: input.quilometragem,
      observacoes: input.observacoes ?? null,
      registrado_por_email: input.registrado_por_email,
      registrado_por_nome: input.registrado_por_nome,
    });

  if (errServico) throw new Error(`registrarTrocaPneu servico: ${errServico.message}`);

  const trocas = input.posicoes.map((p) => ({
    id_servico: idServico,
    posicao: p.posicao,
    numero_fogo: p.numero_fogo ?? null,
    quilometragem: input.quilometragem,
  }));

  const { error: errTrocas } = await supabaseManutencao
    .from("trocas_pneus_app")
    .insert(trocas);

  if (errTrocas) throw new Error(`registrarTrocaPneu trocas: ${errTrocas.message}`);
  return idServico;
}

export async function listTrocasByVeiculo(
  codigoFrota: string,
  limit = 50
): Promise<Array<ServicoApp & { trocas: TrocaPneuApp[] }>> {
  const { data, error } = await supabaseManutencao
    .from("servicos_app")
    .select("*, trocas:trocas_pneus_app(*)")
    .eq("id_veiculo", codigoFrota)
    .eq("tipo_servico", "troca_pneu")
    .order("data_servico", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listTrocasByVeiculo: ${error.message}`);
  return data as Array<ServicoApp & { trocas: TrocaPneuApp[] }>;
}

export async function listNumeroFogo(
  placa: string,
  limit = 20
): Promise<NumeroFogo[]> {
  const { data, error } = await supabaseManutencao
    .from("numero_fogo")
    .select("*")
    .ilike("placa", `%${placa}%`)
    .order("data", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listNumeroFogo: ${error.message}`);
  return (data ?? []) as NumeroFogo[];
}
```

- [ ] **Step 2: Criar `app/(app)/pneus/_actions.ts`**

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { registrarTrocaPneu } from "@/lib/repos/manutencao/pneus";
import { redirect } from "next/navigation";

const TrocaSchema = z.object({
  id_veiculo: z.string().min(1),
  quilometragem: z.coerce.number().int().positive(),
  observacoes: z.string().optional(),
  posicoes: z.string().transform((val) => JSON.parse(val) as Array<{ posicao: string; numero_fogo?: string }>),
});

export async function registrarTrocaAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");

  const input = TrocaSchema.parse(Object.fromEntries(formData));
  const idServico = await registrarTrocaPneu({
    ...input,
    registrado_por_email: user.email,
    registrado_por_nome: user.name,
  });

  revalidatePath("/pneus");
  return { ok: true, id_servico: idServico };
}
```

- [ ] **Step 3: Criar `app/(app)/pneus/page.tsx`**

```typescript
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { listVeiculos } from "@/lib/repos/manutencao/pneus";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Wrench } from "lucide-react";
import type { Veiculo } from "@/lib/repos/manutencao/types";

export const dynamic = "force-dynamic";

export default async function PneusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");

  const sp = await searchParams;
  const veiculos = await listVeiculos(sp.q);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Manutenção</p>
        <h1 className="text-3xl font-semibold tracking-tight">Gestão de Pneus</h1>
      </div>

      <form className="grid gap-2 rounded-md border bg-white p-3 shadow-sm sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Frota, placa ou modelo" className="pl-9" />
        </div>
        <Button type="submit">Buscar</Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {veiculos.map((v) => (
          <VeiculoCard key={v.id} veiculo={v} />
        ))}
        {veiculos.length === 0 && (
          <p className="col-span-full py-8 text-center text-muted-foreground">
            Nenhum veículo encontrado.
          </p>
        )}
      </div>
    </div>
  );
}

function VeiculoCard({ veiculo }: { veiculo: Veiculo }) {
  return (
    <article className="rounded-md border bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Frota {veiculo.codigo_frota}</h2>
          <p className="text-sm text-muted-foreground">
            {veiculo.placa ?? "Sem placa"} — {veiculo.modelo ?? "Sem modelo"}
          </p>
        </div>
        <Badge variant="outline">{veiculo.qtd_pneus} pneus</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{veiculo.local ?? "Sem local"}</p>
      <Button size="sm" className="w-full" asChild>
        <a href={`/pneus/${encodeURIComponent(veiculo.codigo_frota)}`}>
          <Wrench className="h-4 w-4" />
          Ver pneus
        </a>
      </Button>
    </article>
  );
}
```

- [ ] **Step 4: Testar no browser**

```bash
npm run dev
```

Abrir `http://localhost:3000/pneus`. A lista de veículos deve aparecer (dados migrados do gestao-pneus).

- [ ] **Step 5: Commit**

```bash
git add lib/repos/manutencao/pneus.ts app/(app)/pneus/
git commit -m "feat: módulo /pneus (lista veículos + registro de trocas)"
```

---

## Task 7: Módulo /manutencao (Radar de Serviços)

**Files:**
- Create: `lib/repos/manutencao/servicos.ts`
- Create: `app/(app)/manutencao/page.tsx`
- Create: `app/(app)/manutencao/_actions.ts`

- [ ] **Step 1: Criar `lib/repos/manutencao/servicos.ts`**

```typescript
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { ServicoApp, TipoServico } from "./types";
import { randomUUID } from "crypto";

export const SERVICO_CONFIG: Array<{
  id: TipoServico;
  label: string;
  intervaloCampo: string;
  intervaloTipo: "km" | "dias";
  intervaloPadrao: number;
}> = [
  { id: "alinhamento",    label: "Alinhamento",      intervaloCampo: "intervalo_alinhamento_km",      intervaloTipo: "km",   intervaloPadrao: 10000 },
  { id: "lavagem",        label: "Lavagem",           intervaloCampo: "intervalo_lavagem_dias",         intervaloTipo: "dias", intervaloPadrao: 30 },
  { id: "ar-condicionado",label: "Ar-condicionado",  intervaloCampo: "intervalo_arcondicionado_dias",  intervaloTipo: "dias", intervaloPadrao: 365 },
  { id: "tacografo",      label: "Tacógrafo",         intervaloCampo: "intervalo_tacografo_dias",       intervaloTipo: "dias", intervaloPadrao: 180 },
  { id: "portas_rool_up", label: "Portas Rool-Up",   intervaloCampo: "intervalo_portas_rool_up_dias",  intervaloTipo: "dias", intervaloPadrao: 60 },
  { id: "embreagem",      label: "Embreagem",         intervaloCampo: "intervalo_embreagem_dias",       intervaloTipo: "dias", intervaloPadrao: 365 },
  { id: "motor",          label: "Motor",             intervaloCampo: "intervalo_motor_km",             intervaloTipo: "km",   intervaloPadrao: 20000 },
  { id: "suspensao",      label: "Suspensão",         intervaloCampo: "intervalo_suspensao_km",         intervaloTipo: "km",   intervaloPadrao: 5000 },
];

export interface UltimoServico {
  tipo_servico: TipoServico;
  data_servico: string;
  quilometragem: number | null;
}

export async function listUltimosServicosByVeiculo(
  codigoFrota: string
): Promise<UltimoServico[]> {
  const tipos = SERVICO_CONFIG.map((s) => s.id);

  const { data, error } = await supabaseManutencao
    .from("servicos_app")
    .select("tipo_servico, data_servico, quilometragem")
    .eq("id_veiculo", codigoFrota)
    .in("tipo_servico", tipos)
    .order("data_servico", { ascending: false });

  if (error) throw new Error(`listUltimosServicosByVeiculo: ${error.message}`);

  // Retorna apenas o último registro por tipo
  const seen = new Set<string>();
  const resultado: UltimoServico[] = [];
  for (const row of data ?? []) {
    if (!seen.has(row.tipo_servico)) {
      seen.add(row.tipo_servico);
      resultado.push(row as UltimoServico);
    }
  }
  return resultado;
}

export interface RegistrarServicoInput {
  id_veiculo: string;
  tipo_servico: TipoServico;
  quilometragem?: number;
  observacoes?: string;
  registrado_por_email: string;
  registrado_por_nome: string;
}

export async function registrarServico(input: RegistrarServicoInput): Promise<string> {
  const idServico = randomUUID();

  const { error } = await supabaseManutencao.from("servicos_app").insert({
    id_servico: idServico,
    id_veiculo: input.id_veiculo,
    tipo_servico: input.tipo_servico,
    quilometragem: input.quilometragem ?? null,
    observacoes: input.observacoes ?? null,
    registrado_por_email: input.registrado_por_email,
    registrado_por_nome: input.registrado_por_nome,
  });

  if (error) throw new Error(`registrarServico: ${error.message}`);
  return idServico;
}

export async function listServicosRecentes(limit = 100): Promise<Array<ServicoApp & { veiculo: { placa: string | null; codigo_frota: string } | null }>> {
  const { data, error } = await supabaseManutencao
    .from("servicos_app")
    .select("*, veiculo:veiculos(codigo_frota, placa)")
    .order("data_servico", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listServicosRecentes: ${error.message}`);
  return data as Array<ServicoApp & { veiculo: { placa: string | null; codigo_frota: string } | null }>;
}
```

- [ ] **Step 2: Criar `app/(app)/manutencao/_actions.ts`**

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { registrarServico } from "@/lib/repos/manutencao/servicos";
import { redirect } from "next/navigation";

const ServicoSchema = z.object({
  id_veiculo: z.string().min(1),
  tipo_servico: z.string().min(1),
  quilometragem: z.coerce.number().int().positive().optional(),
  observacoes: z.string().optional(),
});

export async function registrarServicoAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");

  const input = ServicoSchema.parse(Object.fromEntries(formData));
  await registrarServico({
    ...input,
    tipo_servico: input.tipo_servico as import("@/lib/repos/manutencao/types").TipoServico,
    registrado_por_email: user.email,
    registrado_por_nome: user.name,
  });

  revalidatePath("/manutencao");
}
```

- [ ] **Step 3: Criar `app/(app)/manutencao/page.tsx`**

```typescript
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { listServicosRecentes, SERVICO_CONFIG } from "@/lib/repos/manutencao/servicos";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ManutencaoPage() {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");

  const servicos = await listServicosRecentes(100);

  const porTipo = SERVICO_CONFIG.map((cfg) => ({
    ...cfg,
    recentes: servicos.filter((s) => s.tipo_servico === cfg.id).slice(0, 5),
  }));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Manutenção</p>
        <h1 className="text-3xl font-semibold tracking-tight">Radar de Serviços</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {porTipo.map((cfg) => (
          <section key={cfg.id} className="rounded-md border bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">{cfg.label}</h2>
            {cfg.recentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem registros recentes.</p>
            ) : (
              <ul className="space-y-2">
                {cfg.recentes.map((s) => (
                  <li key={s.id_servico} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.veiculo?.codigo_frota ?? s.id_veiculo}</span>
                    <span className="text-muted-foreground">{formatDate(s.data_servico)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <section className="overflow-hidden rounded-md border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-4 py-3 font-semibold">Últimos 100 serviços</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Frota</th>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Serviço</th>
                <th className="px-4 py-3 text-right">KM</th>
              </tr>
            </thead>
            <tbody>
              {servicos.map((s) => (
                <tr key={s.id_servico} className="border-t">
                  <td className="px-4 py-3">{formatDate(s.data_servico)}</td>
                  <td className="px-4 py-3 font-medium">{s.veiculo?.codigo_frota ?? s.id_veiculo}</td>
                  <td className="px-4 py-3">{s.veiculo?.placa ?? "—"}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{s.tipo_servico}</Badge></td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.quilometragem?.toLocaleString("pt-BR") ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Testar e commit**

```bash
npm run dev
# Abrir http://localhost:3000/manutencao
git add lib/repos/manutencao/servicos.ts app/(app)/manutencao/
git commit -m "feat: módulo /manutencao — radar de serviços"
```

---

## Task 8: Módulo /equipamentos

**Files:**
- Create: `lib/repos/manutencao/equipamentos.ts`
- Create: `app/(app)/equipamentos/page.tsx`
- Create: `app/(app)/equipamentos/_actions.ts`

- [ ] **Step 1: Criar `lib/repos/manutencao/equipamentos.ts`**

```typescript
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { EquipamentoApp, SegmentoEquipamento, TipoPreventiva } from "./types";

export async function listEquipamentos(
  segmento?: SegmentoEquipamento,
  apenasAtivos = true
): Promise<EquipamentoApp[]> {
  let q = supabaseManutencao.from("equipamentos_app").select("*");
  if (segmento) q = q.eq("segmento", segmento);
  if (apenasAtivos) q = q.eq("ativo", true);
  const { data, error } = await q.order("numero_equip");
  if (error) throw new Error(`listEquipamentos: ${error.message}`);
  return (data ?? []) as EquipamentoApp[];
}

export async function getEquipamento(id: string) {
  const { data, error } = await supabaseManutencao
    .from("equipamentos_app")
    .select("*, preventivas:equipamentos_preventivas_app(*), componentes:equipamentos_componentes_app(*)")
    .eq("id", id)
    .single();
  if (error) throw new Error(`getEquipamento: ${error.message}`);
  return data;
}

export async function registrarPreventiva(input: {
  equipamento_id: string;
  tipo_preventiva: TipoPreventiva;
  data_servico: string;
  horimetro_servico: number;
  observacoes?: string;
  registrado_por_email: string;
  registrado_por_nome: string;
}) {
  const { error } = await supabaseManutencao
    .from("equipamentos_preventivas_app")
    .insert({
      ...input,
      registrado_por_id: input.registrado_por_email,
    });
  if (error) throw new Error(`registrarPreventiva: ${error.message}`);

  // Atualiza horimetro base no equipamento
  const campo = input.tipo_preventiva === "300h" ? "horimetro_base_300h" : "horimetro_base_1500h";
  const { error: errUpdate } = await supabaseManutencao
    .from("equipamentos_app")
    .update({
      horimetro_atual: input.horimetro_servico,
      [campo]: input.horimetro_servico,
    })
    .eq("id", input.equipamento_id);
  if (errUpdate) throw new Error(`registrarPreventiva update: ${errUpdate.message}`);
}
```

- [ ] **Step 2: Criar `app/(app)/equipamentos/_actions.ts`**

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { registrarPreventiva } from "@/lib/repos/manutencao/equipamentos";
import { redirect } from "next/navigation";

const PreventivaSchema = z.object({
  equipamento_id: z.string().uuid(),
  tipo_preventiva: z.enum(["300h", "1500h"]),
  data_servico: z.string().min(1),
  horimetro_servico: z.coerce.number().positive(),
  observacoes: z.string().optional(),
});

export async function registrarPreventivaAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");

  const input = PreventivaSchema.parse(Object.fromEntries(formData));
  await registrarPreventiva({
    ...input,
    registrado_por_email: user.email,
    registrado_por_nome: user.name,
  });
  revalidatePath("/equipamentos");
}
```

- [ ] **Step 3: Criar `app/(app)/equipamentos/page.tsx`**

```typescript
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { listEquipamentos } from "@/lib/repos/manutencao/equipamentos";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EquipamentoApp, SegmentoEquipamento } from "@/lib/repos/manutencao/types";

export const dynamic = "force-dynamic";

const SEGMENTO_LABELS: Record<SegmentoEquipamento, string> = {
  EMPILHADEIRA: "Empilhadeira",
  SELECIONADORA: "Selecionadora",
  PALETEIRA: "Paleteira",
};

export default async function EquipamentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");

  const sp = await searchParams;
  const segmento = sp.segmento as SegmentoEquipamento | undefined;
  const equipamentos = await listEquipamentos(segmento);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Equipamentos</p>
        <h1 className="text-3xl font-semibold tracking-tight">Equipamentos</h1>
      </div>

      <div className="flex gap-2">
        {(["EMPILHADEIRA", "SELECIONADORA", "PALETEIRA"] as SegmentoEquipamento[]).map((s) => (
          <a key={s} href={`/equipamentos?segmento=${s}`}>
            <Badge
              variant={segmento === s ? "default" : "outline"}
              className="cursor-pointer"
            >
              {SEGMENTO_LABELS[s]}
            </Badge>
          </a>
        ))}
        {segmento && <a href="/equipamentos"><Badge variant="outline">Todos</Badge></a>}
      </div>

      <section className="overflow-hidden rounded-md border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Equipamento</th>
                <th className="px-4 py-3">Segmento</th>
                <th className="px-4 py-3">Local</th>
                <th className="px-4 py-3 text-right">Horímetro</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {equipamentos.map((eq) => (
                <tr key={eq.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{eq.numero_equip}</td>
                  <td className="px-4 py-3">{eq.equipamento}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{SEGMENTO_LABELS[eq.segmento]}</Badge>
                  </td>
                  <td className="px-4 py-3">{eq.local ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {eq.horimetro_atual?.toLocaleString("pt-BR") ?? "—"}h
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/equipamentos/${eq.id}`}>Detalhe</a>
                    </Button>
                  </td>
                </tr>
              ))}
              {equipamentos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum equipamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Testar e commit**

```bash
npm run dev
# Abrir http://localhost:3000/equipamentos
git add lib/repos/manutencao/equipamentos.ts app/(app)/equipamentos/
git commit -m "feat: módulo /equipamentos (lista + filtro por segmento)"
```

---

## Task 9: Módulo /operacao

**Files:**
- Create: `lib/repos/manutencao/operacao.ts`
- Create: `app/(app)/operacao/page.tsx`
- Create: `app/(app)/operacao/_actions.ts`

- [ ] **Step 1: Criar `lib/repos/manutencao/operacao.ts`**

```typescript
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { DemandaApp, StatusDemanda, PrioridadeDemanda } from "./types";

export async function listDemandas(
  status?: StatusDemanda,
  limit = 100
): Promise<DemandaApp[]> {
  let q = supabaseManutencao
    .from("operacao_demandas_app")
    .select("id,status,descricao,tipo_movimentacao,prioridade,motorista_nome,motorista_email,id_veiculo,destino,concluido_em,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw new Error(`listDemandas: ${error.message}`);
  return (data ?? []) as DemandaApp[];
}

export async function criarDemanda(input: {
  descricao: string;
  tipo_movimentacao: string;
  prioridade: PrioridadeDemanda;
  destino?: string;
  id_veiculo?: string;
  criado_por_email: string;
  criado_por_nome: string;
}): Promise<string> {
  const { data, error } = await supabaseManutencao
    .from("operacao_demandas_app")
    .insert({
      descricao: input.descricao,
      tipo_movimentacao: input.tipo_movimentacao,
      prioridade: input.prioridade,
      destino: input.destino ?? null,
      id_veiculo: input.id_veiculo ?? null,
      criado_por_email: input.criado_por_email,
      criado_por_nome: input.criado_por_nome,
      criado_por_id: input.criado_por_email,
    })
    .select("id")
    .single();

  if (error) throw new Error(`criarDemanda: ${error.message}`);
  return data.id as string;
}

export async function atualizarStatusDemanda(
  id: string,
  status: StatusDemanda,
  observacoes?: string
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (status === "concluido") update.concluido_em = new Date().toISOString();
  if (observacoes) update.conclusao_observacoes = observacoes;

  const { error } = await supabaseManutencao
    .from("operacao_demandas_app")
    .update(update)
    .eq("id", id);
  if (error) throw new Error(`atualizarStatusDemanda: ${error.message}`);
}

export async function kpisDemandas() {
  const { data, error } = await supabaseManutencao
    .from("operacao_demandas_app")
    .select("status");

  if (error) throw new Error(`kpisDemandas: ${error.message}`);

  const counts = { disponivel: 0, em_andamento: 0, concluido: 0, cancelado: 0 };
  for (const row of data ?? []) {
    const s = row.status as StatusDemanda;
    if (s in counts) counts[s]++;
  }
  return counts;
}
```

- [ ] **Step 2: Criar `app/(app)/operacao/_actions.ts`**

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAppUser, canAccessOperacao } from "@/lib/rbac";
import { criarDemanda, atualizarStatusDemanda } from "@/lib/repos/manutencao/operacao";
import { redirect } from "next/navigation";

const DemandaSchema = z.object({
  descricao: z.string().min(3),
  tipo_movimentacao: z.enum(["retirada", "levar_frota"]),
  prioridade: z.enum(["baixa", "normal", "alta", "urgente"]),
  destino: z.string().optional(),
  id_veiculo: z.string().optional(),
});

export async function criarDemandaAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canAccessOperacao(user.perfil)) redirect("/");

  const input = DemandaSchema.parse(Object.fromEntries(formData));
  await criarDemanda({ ...input, criado_por_email: user.email, criado_por_nome: user.name });
  revalidatePath("/operacao");
}

export async function atualizarStatusAction(id: string, status: string) {
  const user = await requireAppUser();
  if (!canAccessOperacao(user.perfil)) redirect("/");

  await atualizarStatusDemanda(
    id,
    status as import("@/lib/repos/manutencao/types").StatusDemanda
  );
  revalidatePath("/operacao");
}
```

- [ ] **Step 3: Criar `app/(app)/operacao/page.tsx`**

```typescript
import { requireAppUser, canAccessOperacao } from "@/lib/rbac";
import { listDemandas, kpisDemandas } from "@/lib/repos/manutencao/operacao";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { DemandaApp, StatusDemanda } from "@/lib/repos/manutencao/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<StatusDemanda, string> = {
  disponivel: "Disponível",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_CLASS: Record<StatusDemanda, string> = {
  disponivel: "border-slate-200 bg-slate-100 text-slate-800",
  em_andamento: "border-blue-200 bg-blue-50 text-blue-800",
  concluido: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelado: "border-red-200 bg-red-50 text-red-800",
};

export default async function OperacaoPage() {
  const user = await requireAppUser();
  if (!canAccessOperacao(user.perfil)) redirect("/");

  const [demandas, kpis] = await Promise.all([listDemandas(), kpisDemandas()]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Operação</p>
        <h1 className="text-3xl font-semibold tracking-tight">Demandas de Operação</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.entries(kpis) as [StatusDemanda, number][]).map(([s, n]) => (
          <Card key={s} className="rounded-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{STATUS_LABEL[s]}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{n}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="overflow-hidden rounded-md border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Destino</th>
                <th className="px-4 py-3">Prioridade</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {demandas.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(d.created_at)}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{d.descricao}</td>
                  <td className="px-4 py-3">{d.motorista_nome ?? "—"}</td>
                  <td className="px-4 py-3">{d.destino ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{d.prioridade}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_CLASS[d.status]}>
                      {STATUS_LABEL[d.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
              {demandas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma demanda encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Testar e commit**

```bash
npm run dev
# Abrir http://localhost:3000/operacao
git add lib/repos/manutencao/operacao.ts app/(app)/operacao/
git commit -m "feat: módulo /operacao — demandas de operação"
```

---

## Task 10: Módulo /oficinas

**Files:**
- Create: `lib/repos/manutencao/oficinas.ts`
- Create: `app/(app)/oficinas/page.tsx`
- Create: `app/(app)/oficinas/_actions.ts`

- [ ] **Step 1: Criar `lib/repos/manutencao/oficinas.ts`**

```typescript
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { OficinasApp } from "./types";

export async function listOficinas(apenasAtivas = true): Promise<OficinasApp[]> {
  let q = supabaseManutencao.from("operacao_oficinas_app").select("*").order("nome");
  if (apenasAtivas) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw new Error(`listOficinas: ${error.message}`);
  return (data ?? []) as OficinasApp[];
}

export async function criarOficina(input: {
  nome: string;
  categoria: string;
  localizacao: string;
  localizacao_lat?: number;
  localizacao_lng?: number;
  tipos_servico: string[];
  horario_inicio?: string;
  horario_fim?: string;
}): Promise<number> {
  const { data, error } = await supabaseManutencao
    .from("operacao_oficinas_app")
    .insert(input)
    .select("id")
    .single();
  if (error) throw new Error(`criarOficina: ${error.message}`);
  return data.id as number;
}
```

- [ ] **Step 2: Criar `app/(app)/oficinas/_actions.ts`**

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { criarOficina } from "@/lib/repos/manutencao/oficinas";
import { redirect } from "next/navigation";

const OficinaSchema = z.object({
  nome: z.string().min(2),
  categoria: z.string().default("oficina"),
  localizacao: z.string().min(2),
  tipos_servico: z.string().transform((val) => val.split(",").map((s) => s.trim()).filter(Boolean)),
});

export async function criarOficinaAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");

  const input = OficinaSchema.parse(Object.fromEntries(formData));
  await criarOficina(input);
  revalidatePath("/oficinas");
}
```

- [ ] **Step 3: Criar `app/(app)/oficinas/page.tsx`**

```typescript
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { listOficinas } from "@/lib/repos/manutencao/oficinas";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import type { OficinasApp } from "@/lib/repos/manutencao/types";

export const dynamic = "force-dynamic";

export default async function OficinasPage() {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");

  const oficinas = await listOficinas();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Manutenção</p>
        <h1 className="text-3xl font-semibold tracking-tight">Oficinas</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {oficinas.map((o) => (
          <OficinaCard key={o.id} oficina={o} />
        ))}
        {oficinas.length === 0 && (
          <p className="col-span-full py-8 text-center text-muted-foreground">
            Nenhuma oficina cadastrada.
          </p>
        )}
      </div>
    </div>
  );
}

function OficinaCard({ oficina }: { oficina: OficinasApp }) {
  const gmapsUrl = oficina.localizacao_lat && oficina.localizacao_lng
    ? `https://maps.google.com/?q=${oficina.localizacao_lat},${oficina.localizacao_lng}`
    : `https://maps.google.com/?q=${encodeURIComponent(oficina.localizacao)}`;

  return (
    <article className="rounded-md border bg-white p-4 shadow-sm space-y-3">
      <div>
        <h2 className="font-semibold">{oficina.nome}</h2>
        <p className="text-sm text-muted-foreground">{oficina.categoria}</p>
      </div>
      <a
        href={gmapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        <MapPin className="h-3 w-3" />
        {oficina.localizacao}
      </a>
      <div className="flex flex-wrap gap-1">
        {oficina.tipos_servico.map((t) => (
          <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
        ))}
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Testar e commit**

```bash
npm run dev
# Abrir http://localhost:3000/oficinas
git add lib/repos/manutencao/oficinas.ts app/(app)/oficinas/
git commit -m "feat: módulo /oficinas — lista e cadastro"
```

---

## Task 11: Sidebar — novos módulos com RBAC

**Files:**
- Modify: `components/app-shell.tsx`

- [ ] **Step 1: Abrir `components/app-shell.tsx` e localizar o array de itens de navegação**

O arquivo define os itens do sidebar. Identificar o padrão existente para adicionar os novos grupos.

- [ ] **Step 2: Adicionar grupo "Manutenção" ao sidebar**

Localizar onde os itens de nav são definidos e adicionar após o grupo existente de Frotas/Checklist:

```typescript
// Adicionar nos imports
import { Wrench, FileText, Boxes, Truck2, Building2 } from "lucide-react";

// Adicionar na lista de nav — após os itens existentes de frotas/checklist:
// Dentro do array de navegação, adicionar:
{
  label: "Manutenção",
  items: [
    {
      href: "/pneus",
      label: "Pneus",
      icon: Truck2,
      visible: canAccessManutencao(perfil),
    },
    {
      href: "/manutencao",
      label: "Serviços",
      icon: Wrench,
      visible: canAccessManutencao(perfil),
    },
    {
      href: "/equipamentos",
      label: "Equipamentos",
      icon: Boxes,
      visible: canAccessManutencao(perfil),
    },
    {
      href: "/operacao",
      label: "Operação",
      icon: Truck2,
      visible: canAccessOperacao(perfil),
    },
    {
      href: "/oficinas",
      label: "Oficinas",
      icon: Building2,
      visible: canAccessManutencao(perfil),
    },
    {
      href: "/documentos",
      label: "Documentos",
      icon: FileText,
      visible: canAccessDocumentos(perfil),
    },
  ],
},
```

> **Nota:** O `app-shell.tsx` atual usa um padrão específico de nav — adaptar a estrutura acima ao padrão exato encontrado no arquivo (pode usar `AppUser.perfil` já disponível no componente via session). Verificar como os outros itens são condicionados por perfil.

- [ ] **Step 3: Importar helpers RBAC no app-shell**

```typescript
import { canAccessManutencao, canAccessOperacao, canAccessDocumentos } from "@/lib/rbac";
```

- [ ] **Step 4: Verificar que itens aparecem/somem conforme perfil**

Logar como MOTORISTA: não deve ver nenhum novo item.
Logar como MANUTENCAO: deve ver Pneus, Serviços, Equipamentos, Oficinas, Documentos.
Logar como ADMIN/DEV: deve ver tudo.

- [ ] **Step 5: Commit**

```bash
git add components/app-shell.tsx lib/rbac.ts
git commit -m "feat: sidebar — novos módulos de manutenção com guarda RBAC"
```

---

## Task 12: Typecheck e validação final

**Files:** nenhum arquivo novo

- [ ] **Step 1: Rodar typecheck**

```bash
npm run typecheck
```

Corrigir todos os erros de TypeScript antes de prosseguir.

- [ ] **Step 2: Rodar testes existentes**

```bash
npm test
```

Confirmar que os testes de `lib/rules.test.ts`, `lib/user.test.ts` e `lib/report-date.test.ts` continuam passando.

- [ ] **Step 3: Testar build de produção**

```bash
npm run build
```

Confirmar que o build não tem erros.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat: plataforma unificada — todos os módulos integrados"
```

---

## Checklist de Verificação Final

- [ ] 19 tabelas criadas no Supabase `nwoqastjgkgsifmxdqwp`
- [ ] Bucket `documents` criado no Storage
- [ ] Dados migrados do gestao-pneus (script executado sem erros)
- [ ] Dados migrados do consulta-documentos-frota (script executado)
- [ ] `lib/supabase-manutencao.ts` funcional (service role, sem session)
- [ ] `/documentos` carrega lista com busca por frota/placa
- [ ] `/pneus` carrega lista de veículos
- [ ] `/manutencao` exibe radar de serviços
- [ ] `/equipamentos` exibe lista filtrável por segmento
- [ ] `/operacao` exibe demandas com KPIs
- [ ] `/oficinas` exibe cards com link Google Maps
- [ ] Sidebar mostra grupos corretos por perfil
- [ ] MOTORISTA não enxerga nenhum módulo novo
- [ ] `npm run typecheck` sem erros
- [ ] `npm run build` sem erros

---

## Notas de implementação

- **Service role keys dos projetos de origem** precisam ser adicionadas ao `.env` antes de rodar os scripts de migração. Chaves fornecidas pelo usuário durante o brainstorming.
- **Arquivos de Storage (DUT/CRLV)** do consulta-documentos-frota precisam ser migrados manualmente via download + re-upload entre os buckets. O script de migração avisa sobre isso.
- **`veiculos.codigo_frota`** é a chave de vínculo com `frotas.frota_geral` no Databricks. O join é feito na camada de aplicação quando necessário (ex: página de detalhe da frota no módulo `/frotas/[id]` pode exibir serviços de manutenção buscando por `frota_geral`).
- **App Shell:** O padrão exato de nav do `components/app-shell.tsx` precisa ser verificado antes do Task 11 — adaptar o código ao padrão encontrado.
