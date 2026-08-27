create sequence if not exists public.pedido_pecas_codigo_seq;

create table if not exists public.fornecedores_pecas (
  id bigserial primary key,
  nome text not null,
  email text not null unique,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

insert into public.fornecedores_pecas (nome, email, ativo, ordem) values
  ('ADS Auto Pecas', 'vendas@adsautopecas.com.br', true, 10),
  ('Barreto Pecas', 'vendas5@barretopecas.com.br', true, 20),
  ('Norte Auto Pecas', 'faturamento@norteautopecas.com.br', true, 30)
on conflict (email) do update set
  nome = excluded.nome,
  ativo = excluded.ativo,
  ordem = excluded.ordem,
  atualizado_em = now();

create table if not exists public.pedidos_pecas (
  id bigserial primary key,
  token_idempotencia uuid not null unique,
  codigo text not null unique default (
    'PC-' || to_char(timezone('America/Manaus', now()), 'YYYYMMDD') || '-' ||
    lpad(nextval('public.pedido_pecas_codigo_seq')::text, 5, '0')
  ),
  frota_id bigint references public.veiculos(id) on delete set null,
  frota_codigo text not null,
  placa text,
  modelo text,
  chassi text,
  ano_fabricacao integer,
  observacao text,
  solicitante_nome text not null,
  solicitante_email text not null,
  status text not null default 'PENDENTE_ENVIO' check (
    status in ('PENDENTE_ENVIO', 'ENVIANDO', 'ENVIADO', 'PARCIAL', 'ERRO_ENVIO')
  ),
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.pedido_pecas_itens (
  id bigserial primary key,
  pedido_id bigint not null references public.pedidos_pecas(id) on delete cascade,
  ordem integer not null,
  descricao text not null,
  quantidade integer not null check (quantidade between 1 and 999),
  constraint pedido_pecas_itens_pedido_ordem_unique unique (pedido_id, ordem)
);

create table if not exists public.pedido_pecas_envios (
  id bigserial primary key,
  pedido_id bigint not null references public.pedidos_pecas(id) on delete cascade,
  fornecedor_nome text not null,
  fornecedor_email text not null,
  copia_email text not null,
  status text not null default 'PENDENTE' check (
    status in ('PENDENTE', 'ENVIANDO', 'ENVIADO', 'ERRO')
  ),
  tentativas integer not null default 0,
  message_id text,
  erro_msg text,
  enviado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  constraint pedido_pecas_envios_fornecedor_unique unique (pedido_id, fornecedor_email)
);

create index if not exists idx_pedidos_pecas_criado
  on public.pedidos_pecas (criado_em desc);
create index if not exists idx_pedidos_pecas_status
  on public.pedidos_pecas (status, criado_em desc);
create index if not exists idx_pedidos_pecas_frota
  on public.pedidos_pecas (frota_id, criado_em desc);
create index if not exists idx_pedido_pecas_itens_pedido
  on public.pedido_pecas_itens (pedido_id, ordem);
create index if not exists idx_pedido_pecas_envios_pedido
  on public.pedido_pecas_envios (pedido_id, status);

drop trigger if exists trg_fornecedores_pecas_updated_at on public.fornecedores_pecas;
create trigger trg_fornecedores_pecas_updated_at
before update on public.fornecedores_pecas
for each row execute function public.set_updated_at();

drop trigger if exists trg_pedidos_pecas_updated_at on public.pedidos_pecas;
create trigger trg_pedidos_pecas_updated_at
before update on public.pedidos_pecas
for each row execute function public.set_updated_at();

alter table public.fornecedores_pecas enable row level security;
alter table public.pedidos_pecas enable row level security;
alter table public.pedido_pecas_itens enable row level security;
alter table public.pedido_pecas_envios enable row level security;

drop policy if exists fornecedores_pecas_service_role on public.fornecedores_pecas;
create policy fornecedores_pecas_service_role on public.fornecedores_pecas
  for all using (public.is_service_role()) with check (public.is_service_role());

drop policy if exists pedidos_pecas_service_role on public.pedidos_pecas;
create policy pedidos_pecas_service_role on public.pedidos_pecas
  for all using (public.is_service_role()) with check (public.is_service_role());

drop policy if exists pedido_pecas_itens_service_role on public.pedido_pecas_itens;
create policy pedido_pecas_itens_service_role on public.pedido_pecas_itens
  for all using (public.is_service_role()) with check (public.is_service_role());

drop policy if exists pedido_pecas_envios_service_role on public.pedido_pecas_envios;
create policy pedido_pecas_envios_service_role on public.pedido_pecas_envios
  for all using (public.is_service_role()) with check (public.is_service_role());

create or replace function public.criar_pedido_pecas(
  p_token_idempotencia uuid,
  p_frota_id bigint,
  p_itens jsonb,
  p_observacao text,
  p_solicitante_nome text,
  p_solicitante_email text,
  p_copia_email text
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_frota public.veiculos%rowtype;
  v_pedido_id bigint;
begin
  select id into v_pedido_id
  from public.pedidos_pecas
  where token_idempotencia = p_token_idempotencia;

  if found then
    return v_pedido_id;
  end if;

  if jsonb_typeof(p_itens) is distinct from 'array'
    or jsonb_array_length(p_itens) < 1
    or jsonb_array_length(p_itens) > 25 then
    raise exception 'Informe entre 1 e 25 pecas.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_itens) item
    where nullif(btrim(item->>'descricao'), '') is null
      or item->>'quantidade' !~ '^[1-9][0-9]{0,2}$'
  ) then
    raise exception 'Revise a descricao e a quantidade das pecas.';
  end if;

  select * into v_frota
  from public.veiculos
  where id = p_frota_id and ativo = true and vendido = false;

  if not found then
    raise exception 'Frota nao encontrada ou inativa.';
  end if;

  if not exists (select 1 from public.fornecedores_pecas where ativo = true) then
    raise exception 'Nenhum fornecedor de pecas esta ativo.';
  end if;

  insert into public.pedidos_pecas (
    token_idempotencia,
    frota_id,
    frota_codigo,
    placa,
    modelo,
    chassi,
    ano_fabricacao,
    observacao,
    solicitante_nome,
    solicitante_email
  ) values (
    p_token_idempotencia,
    v_frota.id,
    coalesce(v_frota.codigo_frota, v_frota.placa, v_frota.id::text),
    v_frota.placa,
    v_frota.modelo,
    v_frota.chassi,
    v_frota.ano_fabricacao,
    nullif(btrim(p_observacao), ''),
    btrim(p_solicitante_nome),
    lower(btrim(p_solicitante_email))
  ) returning id into v_pedido_id;

  insert into public.pedido_pecas_itens (pedido_id, ordem, descricao, quantidade)
  select
    v_pedido_id,
    item_ordem::integer,
    btrim(item->>'descricao'),
    (item->>'quantidade')::integer
  from jsonb_array_elements(p_itens) with ordinality as itens(item, item_ordem);

  insert into public.pedido_pecas_envios (
    pedido_id,
    fornecedor_nome,
    fornecedor_email,
    copia_email
  )
  select
    v_pedido_id,
    nome,
    lower(email),
    lower(btrim(p_copia_email))
  from public.fornecedores_pecas
  where ativo = true
  order by ordem, id;

  return v_pedido_id;
end;
$$;

revoke all on function public.criar_pedido_pecas(uuid, bigint, jsonb, text, text, text, text) from public;
grant execute on function public.criar_pedido_pecas(uuid, bigint, jsonb, text, text, text, text) to service_role;
