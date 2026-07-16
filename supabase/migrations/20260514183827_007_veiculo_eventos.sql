
-- Tabela unificada de eventos por veículo (event sourcing)
create table if not exists public.veiculo_eventos (
  id bigserial primary key,
  veiculo_id bigint not null references public.veiculos(id) on delete cascade,
  tipo_evento text not null check (tipo_evento in (
    'CHECKLIST_ENVIADO',
    'KM_ALTERADO',
    'KM_DIVERGENTE',
    'COMBUSTIVEL_REGISTRADO',
    'STATUS_ALTERADO',
    'PENDENCIA_CRIADA',
    'PENDENCIA_RESOLVIDA',
    'DOCUMENTO_VENCENDO',
    'DOCUMENTO_VENCIDO',
    'MANUTENCAO_ATRASADA',
    'PNEU_CRITICO',
    'ALERTA_CRIADO',
    'ALERTA_RESOLVIDO'
  )),
  origem text not null,
  origem_id bigint,
  titulo text not null,
  descricao text,
  severidade text check (severidade is null or severidade in ('OK','ATENCAO','CRITICO','MANUTENCAO','BLOQUEIO','INFO','NEUTRO')),
  payload jsonb,
  usuario_id text,
  criado_em timestamptz not null default now()
);

create index if not exists veiculo_eventos_vid_idx on public.veiculo_eventos (veiculo_id, criado_em desc);
create index if not exists veiculo_eventos_tipo_idx on public.veiculo_eventos (tipo_evento, criado_em desc);

-- Combustível atual no veículo (última leitura válida)
alter table public.veiculos
  add column if not exists combustivel_atual_litros double precision,
  add column if not exists combustivel_atual_nivel integer check (combustivel_atual_nivel is null or (combustivel_atual_nivel >= 0 and combustivel_atual_nivel <= 4)),
  add column if not exists combustivel_atualizado_em timestamptz,
  add column if not exists combustivel_origem text;

-- Histórico de combustível (independente do veiculo_eventos para análise rápida)
create table if not exists public.veiculo_combustivel_historico (
  id bigserial primary key,
  veiculo_id bigint not null references public.veiculos(id) on delete cascade,
  checklist_id bigint references public.checklists_frota(id) on delete set null,
  litros double precision,
  nivel_relativo integer check (nivel_relativo is null or (nivel_relativo >= 0 and nivel_relativo <= 4)),
  origem text not null,
  usuario_id text,
  criado_em timestamptz not null default now()
);

create index if not exists veiculo_comb_hist_vid_idx on public.veiculo_combustivel_historico (veiculo_id, criado_em desc);

-- RLS
alter table public.veiculo_eventos enable row level security;
alter table public.veiculo_combustivel_historico enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='veiculo_eventos' and policyname='service_role_only') then
    create policy "service_role_only" on public.veiculo_eventos
      using (public.is_service_role()) with check (public.is_service_role());
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='veiculo_combustivel_historico' and policyname='service_role_only') then
    create policy "service_role_only" on public.veiculo_combustivel_historico
      using (public.is_service_role()) with check (public.is_service_role());
  end if;
end $$;
;
