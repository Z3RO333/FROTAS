-- Perfil restrito aos gestores das áreas responsáveis por aprovar saídas da portaria.
begin;

alter table public.usuarios
  drop constraint if exists usuarios_perfil_check;

alter table public.usuarios
  add constraint usuarios_perfil_check
  check (perfil in (
    'MOTORISTA',
    'PORTARIA',
    'APROVADOR',
    'MANUTENCAO',
    'GESTOR',
    'ADMIN',
    'DEV'
  ));

create or replace function public.enforce_aprovador_for_forced_exit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.tipo_acao, new.tipo_movimentacao) = 'LIBERACAO_FORCADA'
     and not exists (
       select 1
       from public.usuarios u
       where u.ativo = true
         and lower(u.email) = lower(new.usuario_portaria_id)
         and u.perfil in ('APROVADOR', 'ADMIN', 'DEV')
     ) then
    raise exception 'Somente aprovadores podem aprovar uma saída bloqueada.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_gestor_for_forced_exit on public.movimentacoes_frota;
create trigger trg_enforce_aprovador_for_forced_exit
before insert or update of tipo_acao, usuario_portaria_id on public.movimentacoes_frota
for each row execute function public.enforce_aprovador_for_forced_exit();

drop function if exists public.enforce_gestor_for_forced_exit();

commit;
