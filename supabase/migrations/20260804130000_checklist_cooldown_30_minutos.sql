-- Mantém a frota disponível independentemente de ENTRADA/SAÍDA e protege
-- contra checklists simultâneos ou repetidos durante 30 minutos.
begin;

drop trigger if exists trg_prevent_checklist_for_vehicle_outside on public.checklists_frota;
drop function if exists public.prevent_checklist_for_vehicle_outside();

create or replace function public.prevent_checklist_during_cooldown()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ultimo_checklist_em timestamptz;
  v_minutos_restantes integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('checklist-cooldown:' || new.frota_id::text, 0)
  );

  select max(coalesce(criado_em, data_checklist)) into v_ultimo_checklist_em
  from public.checklists_frota
  where frota_id = new.frota_id;

  if v_ultimo_checklist_em > now() - interval '30 minutes' then
    v_minutos_restantes := greatest(
      1,
      ceil(extract(epoch from (v_ultimo_checklist_em + interval '30 minutes' - now())) / 60)::integer
    );
    raise exception 'Aguarde % minuto(s) para fazer outro checklist nesta frota.', v_minutos_restantes
      using errcode = 'P0002';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_checklist_during_cooldown on public.checklists_frota;
create trigger trg_prevent_checklist_during_cooldown
before insert on public.checklists_frota
for each row execute function public.prevent_checklist_during_cooldown();

commit;
