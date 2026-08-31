-- A constraint de perfil não foi atualizada quando o perfil MOTORISTA_INTERNO
-- foi criado, bloqueando qualquer update/insert de usuário para esse perfil.
begin;

alter table public.usuarios
  drop constraint if exists usuarios_perfil_check;

alter table public.usuarios
  add constraint usuarios_perfil_check
  check (perfil in (
    'MOTORISTA',
    'MOTORISTA_INTERNO',
    'PORTARIA',
    'APROVADOR',
    'MANUTENCAO',
    'GESTOR',
    'ADMIN',
    'DEV'
  ));

commit;
