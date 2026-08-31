-- Permite atribuir uma atividade a mais de um motorista interno (turnos
-- diferentes) — quem concluir primeiro resolve pra todos os designados.
begin;

alter table public.atividades_manutencao
  add column if not exists motorista_ids text[],
  add column if not exists motorista_nomes text[],
  add column if not exists concluido_por_id text references public.usuarios(id),
  add column if not exists concluido_por_nome text;

update public.atividades_manutencao
set motorista_ids = array[motorista_id],
    motorista_nomes = array[motorista_nome]
where motorista_ids is null;

alter table public.atividades_manutencao
  alter column motorista_ids set not null,
  alter column motorista_nomes set not null;

drop index if exists atividades_manutencao_motorista_status_idx;

alter table public.atividades_manutencao
  drop column if exists motorista_id,
  drop column if exists motorista_nome;

create index if not exists atividades_manutencao_motorista_ids_gin_idx
  on public.atividades_manutencao using gin (motorista_ids);
create index if not exists atividades_manutencao_status_idx
  on public.atividades_manutencao (status);

commit;
