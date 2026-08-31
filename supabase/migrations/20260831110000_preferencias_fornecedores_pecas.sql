-- Guarda a última seleção de fornecedores de peças de cada usuário, para
-- pré-marcar automaticamente no próximo pedido em vez de marcar todos.
begin;

create table if not exists public.preferencias_fornecedores_pecas (
  usuario_email text primary key,
  fornecedor_ids bigint[] not null default '{}',
  atualizado_em timestamptz not null default now()
);

alter table public.preferencias_fornecedores_pecas enable row level security;

drop policy if exists preferencias_fornecedores_pecas_service_role on public.preferencias_fornecedores_pecas;
create policy preferencias_fornecedores_pecas_service_role on public.preferencias_fornecedores_pecas
  for all using (public.is_service_role()) with check (public.is_service_role());

commit;
