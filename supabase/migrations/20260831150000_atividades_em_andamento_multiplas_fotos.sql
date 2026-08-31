-- Duas mudanças no ciclo de vida da atividade:
--
-- 1) Passo "em andamento": o motorista inicia a viagem e só então libera o
--    concluir. Além de refletir a operação real, permite medir a duração da
--    viagem em si (iniciado_em -> concluido_em) em vez de contar desde a
--    criação, que incluía o tempo parada esperando alguém pegar.
-- 2) Várias fotos por atividade em vez de uma só.
begin;

alter table public.atividades_manutencao
  add column if not exists iniciado_em timestamptz,
  add column if not exists foto_conclusao_paths text[] not null default '{}';

alter table public.atividades_manutencao
  drop constraint if exists atividades_manutencao_status_check;

alter table public.atividades_manutencao
  add constraint atividades_manutencao_status_check
  check (status in ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA'));

-- Preserva as fotos já enviadas no formato antigo (coluna única).
update public.atividades_manutencao
set foto_conclusao_paths = array[foto_conclusao_path]
where foto_conclusao_path is not null
  and cardinality(foto_conclusao_paths) = 0;

alter table public.atividades_manutencao
  drop column if exists foto_conclusao_path;

commit;
