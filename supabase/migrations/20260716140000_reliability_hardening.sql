-- Reliability and security hardening.
-- Apply before deploying the application version that sends submission_id and
-- the extended criar_checklist_atomico payload.

begin;

-- Reconcile tables that were missing in partially migrated environments.
insert into storage.buckets (id, name, public)
values ('checklist-images', 'checklist-images', false)
on conflict (id) do update set public = false;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'service_role_checklist_images_all'
  ) then
    create policy service_role_checklist_images_all on storage.objects
      for all
      using (bucket_id = 'checklist-images' and public.is_service_role())
      with check (bucket_id = 'checklist-images' and public.is_service_role());
  end if;
end $$;

create table if not exists public.veiculo_eventos (
  id bigserial primary key,
  veiculo_id bigint not null references public.veiculos(id) on delete cascade,
  tipo_evento text not null,
  origem text not null,
  origem_id bigint,
  titulo text not null,
  descricao text,
  severidade text,
  payload jsonb,
  usuario_id text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_veiculo_eventos_veiculo_data
  on public.veiculo_eventos(veiculo_id, criado_em desc);
alter table public.veiculo_eventos enable row level security;
drop policy if exists service_role_only on public.veiculo_eventos;
create policy service_role_only on public.veiculo_eventos
  for all using (public.is_service_role()) with check (public.is_service_role());

alter table public.veiculos
  add column if not exists combustivel_atual_litros double precision,
  add column if not exists combustivel_atual_nivel integer,
  add column if not exists combustivel_atualizado_em timestamptz,
  add column if not exists combustivel_origem text;

create table if not exists public.veiculo_combustivel_historico (
  id bigserial primary key,
  veiculo_id bigint not null references public.veiculos(id) on delete cascade,
  checklist_id bigint references public.checklists_frota(id) on delete set null,
  litros double precision check (litros is null or litros >= 0),
  nivel_relativo integer check (nivel_relativo is null or nivel_relativo between 0 and 4),
  origem text not null,
  usuario_id text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_veiculo_combustivel_historico_veiculo
  on public.veiculo_combustivel_historico(veiculo_id, criado_em desc);
alter table public.veiculo_combustivel_historico enable row level security;
drop policy if exists service_role_only on public.veiculo_combustivel_historico;
create policy service_role_only on public.veiculo_combustivel_historico
  for all using (public.is_service_role()) with check (public.is_service_role());

alter table public.veiculos
  add column if not exists manutencao_motivo text,
  add column if not exists manutencao_tipo text,
  add column if not exists manutencao_oficina text,
  add column if not exists manutencao_prev_retorno date,
  add column if not exists manutencao_observacao text,
  add column if not exists manutencao_iniciado_em timestamptz,
  add column if not exists manutencao_iniciado_por text,
  add column if not exists manutencao_bloqueia_checklist boolean default true,
  add column if not exists arla_atual_nivel integer,
  add column if not exists arla_atualizado_em timestamptz,
  add column if not exists arla_origem text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.veiculos'::regclass
      and conname = 'veiculos_manutencao_tipo_check'
  ) then
    alter table public.veiculos add constraint veiculos_manutencao_tipo_check
      check (manutencao_tipo is null or manutencao_tipo in ('PREVENTIVA','CORRETIVA','EMERGENCIAL','OUTRA'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.veiculos'::regclass
      and conname = 'veiculos_arla_atual_nivel_check'
  ) then
    alter table public.veiculos add constraint veiculos_arla_atual_nivel_check
      check (arla_atual_nivel is null or arla_atual_nivel between 0 and 4);
  end if;
end $$;

create table if not exists public.veiculo_arla_historico (
  id bigserial primary key,
  veiculo_id bigint not null references public.veiculos(id) on delete cascade,
  checklist_id bigint references public.checklists_frota(id) on delete set null,
  nivel_relativo integer check (nivel_relativo is null or nivel_relativo between 0 and 4),
  origem text not null,
  usuario_id text,
  criado_em timestamptz not null default now()
);
create index if not exists veiculo_arla_hist_vid_idx
  on public.veiculo_arla_historico (veiculo_id, criado_em desc);
alter table public.veiculo_arla_historico enable row level security;
drop policy if exists service_role_only on public.veiculo_arla_historico;
create policy service_role_only on public.veiculo_arla_historico
  for all using (public.is_service_role()) with check (public.is_service_role());

alter table public.veiculo_eventos drop constraint if exists veiculo_eventos_tipo_evento_check;
alter table public.veiculo_eventos add constraint veiculo_eventos_tipo_evento_check
  check (tipo_evento in (
    'CHECKLIST_ENVIADO','KM_ALTERADO','KM_DIVERGENTE','COMBUSTIVEL_REGISTRADO',
    'STATUS_ALTERADO','MANUTENCAO_INICIADA','MANUTENCAO_FINALIZADA',
    'MANUTENCAO_PRORROGADA','PENDENCIA_CRIADA','PENDENCIA_RESOLVIDA',
    'DOCUMENTO_VENCENDO','DOCUMENTO_VENCIDO','MANUTENCAO_ATRASADA',
    'PNEU_CRITICO','ALERTA_CRIADO','ALERTA_RESOLVIDO','LIBERACAO_FORCADA'
  ));

create table if not exists public.checklist_image_inspections (
  id uuid primary key default gen_random_uuid(),
  checklist_id bigint not null references public.checklists_frota(id) on delete cascade,
  checklist_item_codigo text,
  source_type text not null check (source_type in ('hodometro', 'item', 'abastecimento')),
  storage_path text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'processed', 'failed')),
  model_name text,
  confidence double precision,
  detections jsonb not null default '[]'::jsonb,
  summary text,
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_started_at timestamptz
);
alter table public.checklist_image_inspections
  add column if not exists processing_started_at timestamptz;

create index if not exists idx_checklist_image_inspections_checklist
  on public.checklist_image_inspections (checklist_id, created_at desc);
create index if not exists idx_checklist_image_inspections_status
  on public.checklist_image_inspections (status, created_at asc);
alter table public.checklist_image_inspections enable row level security;

drop policy if exists service_role_only on public.checklist_image_inspections;
create policy service_role_only on public.checklist_image_inspections
  for all using (public.is_service_role()) with check (public.is_service_role());

create table if not exists public.usuarios_auditoria (
  id bigserial primary key,
  usuario_id text not null,
  acao text not null,
  valor_antigo text,
  valor_novo text,
  alterado_por text,
  alterado_em timestamptz not null default now()
);
alter table public.usuarios_auditoria enable row level security;
drop policy if exists service_role_only on public.usuarios_auditoria;
create policy service_role_only on public.usuarios_auditoria
  for all using (public.is_service_role()) with check (public.is_service_role());

alter table public.usuarios add column if not exists atualizado_em timestamptz not null default now();
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.usuarios'::regclass and conname = 'usuarios_perfil_check'
  ) then
    alter table public.usuarios add constraint usuarios_perfil_check
      check (perfil in ('MOTORISTA','PORTARIA','MANUTENCAO','GESTOR','ADMIN','DEV'));
  end if;
end $$;
create index if not exists usuarios_email_lower_idx on public.usuarios (lower(email));
create index if not exists usuarios_perfil_ativo_idx on public.usuarios (perfil, ativo);

-- Reconcile scheduled email and incident structures that existed in production
-- but were not consistently represented in migration history.
alter table public.email_logs
  add column if not exists cd_nome text,
  add column if not exists resumo text,
  add column if not exists conteudo_html text,
  add column if not exists schedule_id bigint references public.email_schedules(id) on delete set null;
create index if not exists idx_email_logs_tipo_enviado on public.email_logs (tipo, enviado_em desc);
create index if not exists idx_email_logs_cd_enviado on public.email_logs (cd_nome, enviado_em desc);
create index if not exists idx_email_schedules_tipo_ativo
  on public.email_schedules (tipo, ativo, proximo_envio);

insert into storage.buckets (id, name, public)
values ('sinistro-media', 'sinistro-media', false)
on conflict (id) do update set public = false;

create table if not exists public.sinistros_frota (
  id bigserial primary key,
  ticket_number text not null unique,
  tipo_sinistro text not null default 'veiculo',
  frota_id bigint references public.veiculos(id) on delete set null,
  numero_frota text,
  placa text,
  motorista_id text not null,
  motorista_nome text,
  data_incidente timestamptz not null default now(),
  endereco text not null,
  latitude numeric,
  longitude numeric,
  setor text,
  descricao text not null,
  houve_feridos boolean not null default false,
  samu_bombeiros_presente boolean,
  terceiros_quantidade integer not null default 0,
  terceiros jsonb not null default '[]'::jsonb,
  media_paths jsonb not null default '[]'::jsonb,
  status text not null default 'PENDENTE',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  telefone_solicitante text,
  precisa_guincho boolean,
  responsavel_atendimento text,
  atendimento_concluido_em timestamptz
);
alter table public.sinistros_frota
  add column if not exists telefone_solicitante text,
  add column if not exists precisa_guincho boolean,
  add column if not exists responsavel_atendimento text,
  add column if not exists atendimento_concluido_em timestamptz;
alter table public.sinistros_frota drop constraint if exists sinistros_frota_tipo_sinistro_check;
alter table public.sinistros_frota add constraint sinistros_frota_tipo_sinistro_check
  check (tipo_sinistro in ('veiculo','casa','socorro'));
alter table public.sinistros_frota enable row level security;
drop policy if exists sinistros_frota_service_role on public.sinistros_frota;
create policy sinistros_frota_service_role on public.sinistros_frota
  for all using (public.is_service_role()) with check (public.is_service_role());
create index if not exists idx_sinistros_frota_motorista on public.sinistros_frota (motorista_id, criado_em desc);
create index if not exists idx_sinistros_frota_frota on public.sinistros_frota (frota_id, criado_em desc);
create index if not exists idx_sinistros_frota_status on public.sinistros_frota (status, criado_em desc);

-- Unit grants. Existing behavior remains global until grants are configured;
-- the application can migrate module by module without inferring membership.
create table if not exists public.usuario_unidades (
  usuario_id text not null references public.usuarios(id) on delete cascade,
  unidade_id bigint not null references public.unidades_operacionais(id) on delete cascade,
  criado_em timestamptz not null default now(),
  criado_por text,
  primary key (usuario_id, unidade_id)
);
alter table public.usuario_unidades enable row level security;
drop policy if exists service_role_only on public.usuario_unidades;
create policy service_role_only on public.usuario_unidades
  for all using (public.is_service_role()) with check (public.is_service_role());

-- The old per-day unique index conflicts with valid SAIDA/ENTRADA/SAIDA flows
-- and with BLOQUEIO/SOLICITACAO_CORRECAO, which share tipo_movimentacao.
drop index if exists public.uq_movimento_frota_tipo_dia;

create or replace function public.registrar_movimentacao_idempotente(
  p_frota_id bigint,
  p_motorista_id text,
  p_checklist_id bigint,
  p_tipo_movimentacao text,
  p_usuario_portaria_id text,
  p_observacao text default null,
  p_tipo_acao text default null,
  p_motivo_bloqueio text default null,
  p_janela_segundos integer default 10
) returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_id bigint;
  v_tipo_acao text := coalesce(p_tipo_acao, p_tipo_movimentacao);
begin
  perform pg_advisory_xact_lock(hashtextextended(p_frota_id::text || ':' || coalesce(p_checklist_id::text, ''), 0));

  select id into v_id
  from public.movimentacoes_frota
  where frota_id = p_frota_id
    and checklist_id is not distinct from p_checklist_id
    and tipo_movimentacao = p_tipo_movimentacao
    and coalesce(tipo_acao, tipo_movimentacao) = v_tipo_acao
    and data_hora >= now() - make_interval(secs => p_janela_segundos)
  order by id desc
  limit 1;

  if v_id is not null then return v_id; end if;

  insert into public.movimentacoes_frota (
    frota_id, motorista_id, checklist_id, tipo_movimentacao,
    data_hora, data_movimentacao, usuario_portaria_id, observacao,
    tipo_acao, motivo_bloqueio
  ) values (
    p_frota_id, p_motorista_id, p_checklist_id, p_tipo_movimentacao,
    now(), (now() at time zone 'America/Manaus')::date,
    p_usuario_portaria_id, p_observacao, v_tipo_acao, p_motivo_bloqueio
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Prevent new normalized identifier duplicates while existing data is cleaned.
create or replace function public.prevent_duplicate_vehicle_identifiers()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_value text;
begin
  v_value := regexp_replace(upper(coalesce(new.placa, '')), '[^A-Z0-9]', '', 'g');
  if v_value <> '' then
    perform pg_advisory_xact_lock(hashtextextended('placa:' || v_value, 0));
  end if;
  if v_value <> '' and exists (
    select 1 from public.veiculos v
    where v.id <> coalesce(new.id, -1)
      and regexp_replace(upper(coalesce(v.placa, '')), '[^A-Z0-9]', '', 'g') = v_value
  ) then raise exception 'Placa já cadastrada em outra frota' using errcode = '23505'; end if;

  v_value := regexp_replace(upper(coalesce(new.chassi, '')), '[^A-Z0-9]', '', 'g');
  if v_value <> '' then
    perform pg_advisory_xact_lock(hashtextextended('chassi:' || v_value, 0));
  end if;
  if v_value <> '' and exists (
    select 1 from public.veiculos v
    where v.id <> coalesce(new.id, -1)
      and regexp_replace(upper(coalesce(v.chassi, '')), '[^A-Z0-9]', '', 'g') = v_value
  ) then raise exception 'Chassi já cadastrado em outra frota' using errcode = '23505'; end if;

  v_value := regexp_replace(upper(coalesce(new.renavam, '')), '[^A-Z0-9]', '', 'g');
  if v_value <> '' then
    perform pg_advisory_xact_lock(hashtextextended('renavam:' || v_value, 0));
  end if;
  if v_value <> '' and exists (
    select 1 from public.veiculos v
    where v.id <> coalesce(new.id, -1)
      and regexp_replace(upper(coalesce(v.renavam, '')), '[^A-Z0-9]', '', 'g') = v_value
  ) then raise exception 'RENAVAM já cadastrado em outra frota' using errcode = '23505'; end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_duplicate_vehicle_identifiers on public.veiculos;
create trigger trg_prevent_duplicate_vehicle_identifiers
before insert or update of placa, chassi, renavam on public.veiculos
for each row execute function public.prevent_duplicate_vehicle_identifiers();
create index if not exists idx_veiculos_placa_normalizada
  on public.veiculos ((regexp_replace(upper(coalesce(placa, '')), '[^A-Z0-9]', '', 'g')));
create index if not exists idx_veiculos_chassi_normalizado
  on public.veiculos ((regexp_replace(upper(coalesce(chassi, '')), '[^A-Z0-9]', '', 'g')));
create index if not exists idx_veiculos_renavam_normalizado
  on public.veiculos ((regexp_replace(upper(coalesce(renavam, '')), '[^A-Z0-9]', '', 'g')));

-- Idempotency and optimistic concurrency fields.
alter table public.checklists_frota add column if not exists submission_id uuid;
create unique index if not exists uq_checklists_submission_id
  on public.checklists_frota (submission_id) where submission_id is not null;
with duplicate_alerts as (
  select id,
         row_number() over (partition by checklist_id order by criado_em desc, id desc) as position
  from public.alertas_frota
  where checklist_id is not null and status = 'ABERTO'
)
update public.alertas_frota alerta
set status = 'IGNORADO',
    resolvido_em = coalesce(alerta.resolvido_em, now()),
    descricao = concat_ws(E'\n', alerta.descricao, 'Duplicidade consolidada pela migration 025.')
from duplicate_alerts duplicate
where alerta.id = duplicate.id and duplicate.position > 1;
create unique index if not exists uq_alerta_aberto_por_checklist
  on public.alertas_frota (checklist_id)
  where checklist_id is not null and status = 'ABERTO';
alter table public.sinistros_frota add column if not exists submission_id uuid;
create unique index if not exists uq_sinistros_submission_id
  on public.sinistros_frota (submission_id) where submission_id is not null;
alter table public.veiculos add column if not exists version bigint not null default 1;

create or replace function public.bump_vehicle_version()
returns trigger language plpgsql as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_bump_vehicle_version on public.veiculos;
create trigger trg_bump_vehicle_version before update on public.veiculos
for each row execute function public.bump_vehicle_version();

-- Atomic job claims prevent duplicate AI calls across workers.
create or replace function public.claim_checklists_analise(p_limit integer default 10, p_checklist_id bigint default null)
returns setof public.checklists_frota
language sql
set search_path = public
as $$
  with candidates as (
    select id from public.checklists_frota
    where analise_status = 'PENDENTE'
      and (p_checklist_id is null or id = p_checklist_id)
    order by criado_em
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update public.checklists_frota c
  set analise_status = 'PROCESSANDO'
  from candidates
  where c.id = candidates.id
  returning c.*;
$$;

create or replace function public.claim_checklist_image_inspections(p_limit integer default 10)
returns setof public.checklist_image_inspections
language sql
set search_path = public
as $$
  with candidates as (
    select id from public.checklist_image_inspections
    where status = 'queued'
       or (status = 'processing' and processing_started_at < now() - interval '15 minutes')
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 25))
  )
  update public.checklist_image_inspections i
  set status = 'processing', processing_started_at = now(), error_message = null
  from candidates
  where i.id = candidates.id
  returning i.*;
$$;

revoke all on function public.registrar_movimentacao_idempotente(bigint, text, bigint, text, text, text, text, text, integer) from public;
grant execute on function public.registrar_movimentacao_idempotente(bigint, text, bigint, text, text, text, text, text, integer) to service_role;
revoke all on function public.claim_checklists_analise(integer, bigint) from public;
grant execute on function public.claim_checklists_analise(integer, bigint) to service_role;
revoke all on function public.claim_checklist_image_inspections(integer) from public;
grant execute on function public.claim_checklist_image_inspections(integer) to service_role;

commit;
