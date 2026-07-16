begin;

alter table public.email_schedules
  add column if not exists processing_token uuid,
  add column if not exists processing_started_at timestamptz,
  add column if not exists dia_mes integer;

alter table public.email_schedules
  drop constraint if exists email_schedules_dia_mes_check,
  add constraint email_schedules_dia_mes_check check (dia_mes is null or dia_mes between 1 and 31);

create index if not exists idx_email_schedules_due
  on public.email_schedules (proximo_envio)
  where ativo = true and processing_token is null;

create or replace function public.claim_email_schedules(
  p_limit integer default 25,
  p_tipo text default null,
  p_exclude_tipo text default null
) returns setof public.email_schedules
language sql
set search_path = public
as $$
  with candidates as (
    select id from public.email_schedules
    where ativo = true
      and proximo_envio is not null
      and proximo_envio <= now()
      and (p_tipo is null or tipo = p_tipo)
      and (p_exclude_tipo is null or tipo <> p_exclude_tipo)
      and (
        processing_token is null
        or processing_started_at < now() - interval '20 minutes'
      )
    order by proximo_envio, id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.email_schedules s
  set processing_token = gen_random_uuid(), processing_started_at = now()
  from candidates
  where s.id = candidates.id
  returning s.*;
$$;

revoke all on function public.claim_email_schedules(integer, text, text) from public;
grant execute on function public.claim_email_schedules(integer, text, text) to service_role;

commit;
