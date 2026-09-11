create table public.reparos_frota (
  id bigint generated always as identity primary key,
  ticket_number text not null unique,
  frota_id bigint references public.veiculos(id),
  numero_frota text,
  placa text,
  km bigint not null,
  litros numeric,
  motivo_verificacao text not null,
  localizacao text not null,
  frota_carregada boolean not null,
  prioridade text not null check (prioridade in ('NORMAL', 'URGENTE', 'ALTA')),
  solicitante_id text not null,
  solicitante_nome text,
  status text not null default 'ABERTA' check (status in ('ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
  responsavel_atendimento text,
  atendimento_concluido_em timestamptz,
  criado_em timestamptz not null default now()
);

create index reparos_frota_frota_id_idx on public.reparos_frota(frota_id);
create index reparos_frota_status_idx on public.reparos_frota(status);
create index reparos_frota_criado_em_idx on public.reparos_frota(criado_em desc);

alter table public.reparos_frota enable row level security;

create policy reparos_frota_service_role on public.reparos_frota
  for all
  using (is_service_role());

alter table public.notificacao_destinatarios drop constraint notificacao_destinatarios_evento_check;
alter table public.notificacao_destinatarios add constraint notificacao_destinatarios_evento_check
  check (evento = ANY (ARRAY['SOCORRO_GERAL'::text, 'SOCORRO_AREA'::text, 'SINISTRO_GERAL'::text, 'REPARO_FROTA_GERAL'::text]));

insert into public.notificacao_destinatarios (evento, chave, destinatarios, atualizado_em, atualizado_por)
values ('REPARO_FROTA_GERAL', '', array['manutencaocd@bemol.com.br'], now(), 'system')
on conflict (evento, chave) do update set destinatarios = excluded.destinatarios, atualizado_em = now();
