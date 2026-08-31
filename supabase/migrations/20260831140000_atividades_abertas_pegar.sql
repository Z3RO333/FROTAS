-- Atividade pode ser criada "em aberto" (sem motorista definido): motorista_ids
-- vazio significa disponível para qualquer motorista interno. O motorista pega
-- a atividade pra si antes de executar, e aí ela some da lista dos outros.
begin;

alter table public.atividades_manutencao
  add column if not exists pego_em timestamptz;

alter table public.atividades_manutencao
  alter column motorista_ids set default '{}',
  alter column motorista_nomes set default '{}';

-- Pegar é uma corrida entre motoristas: dois podem clicar ao mesmo tempo. O
-- update condicional garante que só o primeiro leva — os demais recebem zero
-- linhas e a aplicação avisa que a atividade já foi pega.
create or replace function public.pegar_atividade_manutencao(
  p_atividade_id bigint,
  p_motorista_id text,
  p_motorista_nome text
) returns setof public.atividades_manutencao
language sql
set search_path = public
as $$
  update public.atividades_manutencao
  set motorista_ids = array[p_motorista_id],
      motorista_nomes = array[p_motorista_nome],
      pego_em = now(),
      atualizado_em = now()
  where id = p_atividade_id
    and status = 'PENDENTE'
    and cardinality(motorista_ids) = 0
  returning *;
$$;

revoke all on function public.pegar_atividade_manutencao(bigint, text, text) from public;
grant execute on function public.pegar_atividade_manutencao(bigint, text, text) to service_role;

commit;
