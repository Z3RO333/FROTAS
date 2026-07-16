-- ============================================================
-- Plataforma Unificada de Gestão de Frotas
-- Supabase projeto: nwoqastjgkgsifmxdqwp
-- Origem: gestao-pneus + consulta-documentos-frota
-- Auth: service_role only (Auth.js/Microsoft no Next.js)
-- ============================================================

create or replace function public.is_service_role()
returns boolean language sql stable as $$
  select current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
     or auth.role() = 'service_role';
$$;
-- MÓDULO: VEÍCULOS / MANUTENÇÃO

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
create table if not exists public.trocas_pneus_app (
  id          bigserial primary key,
  id_servico  text not null references public.servicos_app(id_servico) on delete cascade,
  posicao     text not null,
  numero_fogo text,
  quilometragem numeric(12,0),
  observacoes text,
  created_at  timestamptz not null default now()
);
create table if not exists public.alinhamentos_app (
  id         bigserial primary key,
  id_servico text not null references public.servicos_app(id_servico) on delete cascade,
  tipo       text not null default 'alinhamento',
  created_at timestamptz not null default now(),
  constraint alinhamentos_app_tipo_ck check (tipo in ('alinhamento','balanceamento'))
);
create table if not exists public.lavagens_app (
  id         bigserial primary key,
  id_servico text not null references public.servicos_app(id_servico) on delete cascade,
  observacoes text,
  created_at timestamptz not null default now()
);
create table if not exists public.servicos_km_base_app (
  id          bigserial primary key,
  id_veiculo  text not null references public.veiculos(codigo_frota) on delete cascade,
  tipo_servico text not null,
  km_base     numeric(12,0) not null,
  data_base   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id_veiculo, tipo_servico)
);
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
-- MÓDULO: EQUIPAMENTOS

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
-- MÓDULO: OPERAÇÃO

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
-- MÓDULO: DOCUMENTOS

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
-- ÍNDICES DE PERFORMANCE

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
-- RLS — service_role only em todas as tabelas

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
-- STORAGE: bucket documents (privado)

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
create policy "service_role_documents_all"
  on storage.objects
  for all
  using (bucket_id = 'documents' and public.is_service_role());
-- TRIGGERS: updated_at automático

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
