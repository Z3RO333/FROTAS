-- Perfis manuais do FROTAS.
-- O login continua via Microsoft, mas o cargo usado pelo sistema vem de public.usuarios.

alter table public.usuarios
  add column if not exists atualizado_em timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_perfil_check'
      and conrelid = 'public.usuarios'::regclass
  ) then
    alter table public.usuarios
      add constraint usuarios_perfil_check
      check (perfil in ('MOTORISTA','PORTARIA','MANUTENCAO','GESTOR','ADMIN','DEV'));
  end if;
end $$;

create index if not exists usuarios_email_lower_idx on public.usuarios (lower(email));
create index if not exists usuarios_perfil_ativo_idx on public.usuarios (perfil, ativo);

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

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'usuarios_auditoria'
      and policyname = 'service_role_only'
  ) then
    create policy "service_role_only"
      on public.usuarios_auditoria
      using (public.is_service_role())
      with check (public.is_service_role());
  end if;
end $$;
