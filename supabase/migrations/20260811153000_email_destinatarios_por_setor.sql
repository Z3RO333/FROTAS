-- Vincula explicitamente cada setor aos destinatarios do seu relatorio.
alter table public.email_schedules
  add column if not exists destinatarios_por_setor jsonb not null default '{}'::jsonb;

alter table public.email_schedules
  drop constraint if exists email_schedules_destinatarios_por_setor_object_check;

alter table public.email_schedules
  add constraint email_schedules_destinatarios_por_setor_object_check
  check (jsonb_typeof(destinatarios_por_setor) = 'object');

-- Compatibilidade: agendas segmentadas antigas passam a usar os destinatarios
-- gerais em cada setor ate que a configuracao seja revisada na interface.
update public.email_schedules schedule
set destinatarios_por_setor = coalesce((
  select jsonb_object_agg(setor, to_jsonb(schedule.destinatarios))
  from unnest(schedule.setores_incluidos) as setor
), '{}'::jsonb)
where cardinality(schedule.setores_incluidos) > 0
  and schedule.destinatarios_por_setor = '{}'::jsonb;
