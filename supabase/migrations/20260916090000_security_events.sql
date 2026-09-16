-- Log de eventos de segurança: login bem-sucedido, falha de senha e SSO
-- barrado por domínio. Base para a página administrativa escondida de
-- segurança (app/(app)/administracao/seguranca).

create table if not exists public.security_events (
  id bigserial primary key,
  tipo_evento text not null check (tipo_evento in (
    'LOGIN_SUCESSO',
    'LOGIN_FALHA',
    'LOGIN_BLOQUEADO_DOMINIO'
  )),
  email text,
  provider text,
  motivo text,
  ip_address text,
  user_agent text,
  criado_em timestamptz not null default now()
);

create index if not exists security_events_email_idx on public.security_events (email, criado_em desc);
create index if not exists security_events_ip_idx on public.security_events (ip_address, criado_em desc);
create index if not exists security_events_criado_em_idx on public.security_events (criado_em desc);

alter table public.security_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='security_events' and policyname='service_role_only') then
    create policy "service_role_only" on public.security_events
      using (public.is_service_role()) with check (public.is_service_role());
  end if;
end $$;
