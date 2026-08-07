-- Migration: suporte a login de motoristas terceiros (sem conta Microsoft/@bemol.com.br).
-- tipo_conta distingue contas autenticadas via Entra ID (INTERNO, comportamento atual)
-- de contas autenticadas por e-mail+senha própria (TERCEIRO). senha_hash guarda o
-- hash bcrypt — nunca a senha em texto puro — e só é preenchido pra contas TERCEIRO.

alter table public.usuarios
  add column if not exists tipo_conta text not null default 'INTERNO'
    check (tipo_conta in ('INTERNO', 'TERCEIRO'));

alter table public.usuarios add column if not exists senha_hash text;
