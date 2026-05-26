insert into storage.buckets (id, name, public)
values ('sinistro-media', 'sinistro-media', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'sinistro_media_service_role'
  ) then
    create policy "sinistro_media_service_role"
      on storage.objects
      for all
      using (bucket_id = 'sinistro-media' and public.is_service_role())
      with check (bucket_id = 'sinistro-media' and public.is_service_role());
  end if;
end $$;

create table if not exists public.sinistros_frota (
  id bigserial primary key,
  ticket_number text not null unique,
  tipo_sinistro text not null default 'veiculo' check (tipo_sinistro in ('veiculo', 'casa')),
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
  atualizado_em timestamptz not null default now()
);

alter table public.sinistros_frota enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sinistros_frota'
      and policyname = 'sinistros_frota_service_role'
  ) then
    create policy "sinistros_frota_service_role"
      on public.sinistros_frota
      for all
      using (public.is_service_role())
      with check (public.is_service_role());
  end if;
end $$;

create index if not exists idx_sinistros_frota_motorista
  on public.sinistros_frota (motorista_id, criado_em desc);

create index if not exists idx_sinistros_frota_frota
  on public.sinistros_frota (frota_id, criado_em desc);

create index if not exists idx_sinistros_frota_status
  on public.sinistros_frota (status, criado_em desc);
