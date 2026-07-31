-- Segregação de função: o operador da PORTARIA registra a movimentação física,
-- mas não autoriza a exceção. Aprovador, gestor, administrador e desenvolvedor
-- podem liberar uma saída bloqueada com justificativa.
begin;

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
         and u.perfil in ('APROVADOR', 'GESTOR', 'ADMIN', 'DEV')
     ) then
    raise exception 'O usuário não possui cargo autorizado para aprovar uma saída bloqueada.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

commit;
