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
  confianca double precision check (confianca is null or (confianca >= 0 and confianca <= 1)),

  -- Metadados
  modelo_ia text,
  analisado_em timestamptz not null default now(),
  revisado_por text,
  revisado_em timestamptz,
  criticidade_revisada text check (criticidade_revisada is null or criticidade_revisada in ('OK','ATENCAO','CRITICO','MANUTENCAO','BLOQUEIO_SUGERIDO')),
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
create index if not exists logs_ia_frota_idx on public.logs_ia (frota_id, criado_em desc);

-- Coluna na checklists_frota para rastrear status da análise
alter table public.checklists_frota
  add column if not exists analise_status text not null default 'PENDENTE'
    check (analise_status in ('PENDENTE','PROCESSANDO','CONCLUIDA','ERRO'));

create index if not exists checklists_analise_status_idx
  on public.checklists_frota (analise_status, criado_em asc)
  where analise_status = 'PENDENTE';

-- Row Level Security
alter table public.analises_checklist_ia enable row level security;
alter table public.alertas_frota enable row level security;
alter table public.logs_ia enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'analises_checklist_ia'
      and policyname = 'service_role_only'
  ) then
    create policy "service_role_only"
      on public.analises_checklist_ia
      using (public.is_service_role())
      with check (public.is_service_role());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'alertas_frota'
      and policyname = 'service_role_only'
  ) then
    create policy "service_role_only"
      on public.alertas_frota
      using (public.is_service_role())
      with check (public.is_service_role());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'logs_ia'
      and policyname = 'service_role_only'
  ) then
    create policy "service_role_only"
      on public.logs_ia
      using (public.is_service_role())
      with check (public.is_service_role());
  end if;
end $$;
