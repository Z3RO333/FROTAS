-- Perfil SUPERVISOR_PORTARIA: acessa a portaria (ver respostas de checklist) e
-- também faz checklist como motorista. A constraint precisa conhecer o valor,
-- senão qualquer update de usuário para esse perfil é rejeitado.
begin;

alter table public.usuarios
  drop constraint if exists usuarios_perfil_check;

alter table public.usuarios
  add constraint usuarios_perfil_check
  check (perfil in (
    'MOTORISTA',
    'MOTORISTA_INTERNO',
    'PORTARIA',
    'SUPERVISOR_PORTARIA',
    'APROVADOR',
    'MANUTENCAO',
    'GESTOR',
    'ADMIN',
    'DEV'
  ));

commit;
