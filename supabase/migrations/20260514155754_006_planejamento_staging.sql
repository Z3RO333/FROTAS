-- supabase/migrations/006_planejamento_staging.sql

-- ─── Staging ──────────────────────────────────────────────────────────────────
create table if not exists public.staging_excel_importacao (
  id            bigserial primary key,
  batch_id      uuid not null,
  nome_arquivo  text not null,
  aba_origem    text not null,
  linha_origem  integer not null,
  dados_json    jsonb not null,
  hash_linha    text not null,
  importado_em  timestamptz not null default now(),
  processado    boolean not null default false
);

create index if not exists staging_excel_batch_idx
  on public.staging_excel_importacao (batch_id, aba_origem);
create unique index if not exists staging_excel_dedup_idx
  on public.staging_excel_importacao (batch_id, aba_origem, hash_linha);

-- ─── KM Histórico ─────────────────────────────────────────────────────────────
create table if not exists public.fact_km_frota (
  id            bigserial primary key,
  equipamento   text,
  frota_numero  text,
  km            integer not null,
  importado_em  timestamptz not null default now(),
  batch_id      uuid
);

create index if not exists fact_km_frota_idx on public.fact_km_frota (frota_numero);
create index if not exists fact_km_batch_idx on public.fact_km_frota (batch_id);

-- ─── Lavagem ──────────────────────────────────────────────────────────────────
create table if not exists public.fact_lavagem (
  id               bigserial primary key,
  equipamento      text,
  placa            text,
  frota_numero     text,
  setor            text,
  data_realizada   date,
  intervalo_dias   integer,
  proxima_data     date,
  dias_apos        integer,
  atraso_dias      integer,
  status           text,
  powerapps_id     text,
  batch_id         uuid,
  unique (equipamento, data_realizada)
);

create index if not exists fact_lavagem_equip_idx on public.fact_lavagem (equipamento);
create index if not exists fact_lavagem_status_idx on public.fact_lavagem (status);

-- ─── Bateria ──────────────────────────────────────────────────────────────────
create table if not exists public.fact_bateria_garantia (
  id             bigserial primary key,
  equipamento    text,
  placa          text,
  frota_numero   text,
  setor          text,
  data_compra    date,
  modelo_bateria text,
  loja           text,
  orcamento      bigint,
  batch_id       uuid,
  unique (equipamento)
);

-- ─── Kit de Segurança ─────────────────────────────────────────────────────────
create table if not exists public.fact_kit_seguranca (
  id                bigserial primary key,
  equipamento       text,
  placa             text,
  frota_numero      text,
  setor             text,
  triangulo_ok      boolean,
  extintor_ok       boolean,
  macaco_ok         boolean,
  chave_roda_ok     boolean,
  data_verificacao  date,
  batch_id          uuid,
  unique (equipamento)
);

-- ─── Estepes ──────────────────────────────────────────────────────────────────
create table if not exists public.fact_estepes (
  id               bigserial primary key,
  frota_numero     text,
  placa            text,
  modelo           text,
  ano              integer,
  local            text,
  setor            text,
  tem_estepe       boolean,
  data_verificacao date,
  batch_id         uuid,
  unique (placa)
);

-- ─── Disponibilidade Diária ───────────────────────────────────────────────────
create table if not exists public.fact_disponibilidade_diaria (
  id              bigserial primary key,
  data            date not null unique,
  total           integer,
  parados         integer,
  disponibilidade numeric(6,4),
  meta            numeric(6,4),
  batch_id        uuid
);

create index if not exists fact_disp_diaria_data_idx on public.fact_disponibilidade_diaria (data desc);

-- ─── Disponibilidade por Tipo ─────────────────────────────────────────────────
create table if not exists public.fact_disponibilidade_tipo_frota (
  id               bigserial primary key,
  data             date not null,
  tipo_equipamento text not null,
  total            integer,
  parados          integer,
  disponibilidade  numeric(6,4),
  batch_id         uuid,
  unique (data, tipo_equipamento)
);

create index if not exists fact_disp_tipo_data_idx on public.fact_disponibilidade_tipo_frota (data desc);

-- ─── Comparativo de Ordens ────────────────────────────────────────────────────
create table if not exists public.fact_comparativo_ordens (
  id           bigserial primary key,
  data_periodo date not null unique,
  qtd_ordens   integer,
  valor_total  numeric(14,2),
  batch_id     uuid
);

-- ─── Manutencao Programada ────────────────────────────────────────────────────
create table if not exists public.fact_manutencao_programada (
  id              bigserial primary key,
  equipamento     text,
  placa           text,
  frota_numero    text,
  local           text,
  setor           text,
  tipo_servico    text check (tipo_servico in (
    'AR_CONDICIONADO','ALINHAMENTO','PREVENTIVA_MOTOR',
    'EMBREAGEM','TACOGRAFO','PORTA_ROOL_UP','SUSPENSAO'
  )),
  data_realizada  date,
  km_inicial      integer,
  km_rodados      integer,
  media_intervalo integer,
  desvio          integer,
  status          text,
  batch_id        uuid,
  unique (equipamento, tipo_servico)
);

create index if not exists fact_manut_prog_equip_idx on public.fact_manutencao_programada (equipamento);
create index if not exists fact_manut_prog_status_idx on public.fact_manutencao_programada (status);

-- ─── Pneus ────────────────────────────────────────────────────────────────────
create table if not exists public.fact_pneus (
  id                   bigserial primary key,
  equipamento          text,
  frota_numero         text,
  km_frota             integer,
  posicao              text,
  numero_fogo          text,
  marca                text,
  dt_montagem          date,
  dt_atualizado        date,
  numero_fogo_anterior text,
  marca_anterior       text,
  status               text,
  marcado              boolean,
  observacoes          text,
  batch_id             uuid,
  unique (equipamento, posicao)
);

-- ─── Documentos ───────────────────────────────────────────────────────────────
create table if not exists public.fact_documentos_frota (
  id               bigserial primary key,
  equipamento      text,
  placa            text,
  frota_numero     text,
  tipo_documento   text check (tipo_documento in ('TACOGRAFO','CRLV','DUT')),
  data_realizada   date,
  media_dias       integer,
  dias_passados    integer,
  desvio           integer,
  data_vencimento  date,
  status           text,
  link_documento   text,
  localizacao      text,
  batch_id         uuid,
  unique (equipamento, tipo_documento)
);

-- ─── Frotas Paradas ───────────────────────────────────────────────────────────
create table if not exists public.fact_frotas_paradas (
  id                   bigserial primary key,
  frota_numero         text,
  placa                text,
  descricao_original   text not null,
  servicos             text,
  classificacao        text,
  oficina              text,
  proxima_programacao  date,
  inicio_em            date,
  prev_saida           date,
  setor                text,
  status               text,
  ia_texto_corrigido   text,
  ia_classificacao     text,
  ia_criticidade       text check (ia_criticidade is null or ia_criticidade in ('BAIXA','MEDIA','ALTA','CRITICA')),
  ia_acao_recomendada  text,
  ia_justificativa     text,
  ia_analisado_em      timestamptz,
  batch_id             uuid
);

create index if not exists fact_paradas_frota_idx on public.fact_frotas_paradas (frota_numero);
create index if not exists fact_paradas_criticidade_idx on public.fact_frotas_paradas (ia_criticidade);;
