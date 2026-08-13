-- Destinatarios de notificacoes reativas (Socorro/Sinistro), hoje fixos no
-- codigo/env var. Editaveis pelo admin sem deploy; o motorista nao ve nada
-- disso, so preenche o formulario normalmente.
create table if not exists public.notificacao_destinatarios (
  id            bigserial primary key,
  evento        text not null check (evento in ('SOCORRO_GERAL', 'SOCORRO_AREA', 'SINISTRO_GERAL')),
  chave         text,
  destinatarios text[] not null default '{}',
  atualizado_em timestamptz not null default now(),
  atualizado_por text,
  constraint notificacao_destinatarios_evento_chave_unique unique (evento, chave)
);

-- SOCORRO_AREA precisa da chave (a area); os eventos gerais nao usam chave —
-- garante que so exista uma linha "geral" por evento (chave is null cai na
-- unique acima sem precisar de indice parcial, unique trata NULL como
-- distinto em Postgres, entao usamos um indice parcial para os gerais).
create unique index if not exists notificacao_destinatarios_geral_unique
  on public.notificacao_destinatarios (evento)
  where chave is null;

alter table public.notificacao_destinatarios enable row level security;

create policy "service_role_only" on public.notificacao_destinatarios
  using (auth.role() = 'service_role');

insert into public.notificacao_destinatarios (evento, chave, destinatarios) values
  ('SOCORRO_GERAL', null, array['monitoramentofrotas@bemol.com.br', 'manutencaocd@bemol.com.br']),
  ('SINISTRO_GERAL', null, array['monitoramentofrotas@bemol.com.br', 'manutencaocd@bemol.com.br'])
on conflict do nothing;
