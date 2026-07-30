-- Existing duplicate identifiers are tolerated until they can be cleaned up.
-- On updates, validate only identifiers that actually changed so unrelated edits
-- and gradual cleanup of legacy records remain possible.
create or replace function public.prevent_duplicate_vehicle_identifiers()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_value text;
begin
  if tg_op = 'INSERT' or new.placa is distinct from old.placa then
    v_value := regexp_replace(upper(coalesce(new.placa, '')), '[^A-Z0-9]', '', 'g');
    if v_value <> '' then
      perform pg_advisory_xact_lock(hashtextextended('placa:' || v_value, 0));
    end if;
    if v_value <> '' and exists (
      select 1 from public.veiculos v
      where v.id <> coalesce(new.id, -1)
        and regexp_replace(upper(coalesce(v.placa, '')), '[^A-Z0-9]', '', 'g') = v_value
    ) then
      raise exception 'Placa já cadastrada em outra frota' using errcode = '23505';
    end if;
  end if;

  if tg_op = 'INSERT' or new.chassi is distinct from old.chassi then
    v_value := regexp_replace(upper(coalesce(new.chassi, '')), '[^A-Z0-9]', '', 'g');
    if v_value <> '' then
      perform pg_advisory_xact_lock(hashtextextended('chassi:' || v_value, 0));
    end if;
    if v_value <> '' and exists (
      select 1 from public.veiculos v
      where v.id <> coalesce(new.id, -1)
        and regexp_replace(upper(coalesce(v.chassi, '')), '[^A-Z0-9]', '', 'g') = v_value
    ) then
      raise exception 'Chassi já cadastrado em outra frota' using errcode = '23505';
    end if;
  end if;

  if tg_op = 'INSERT' or new.renavam is distinct from old.renavam then
    v_value := regexp_replace(upper(coalesce(new.renavam, '')), '[^A-Z0-9]', '', 'g');
    if v_value <> '' then
      perform pg_advisory_xact_lock(hashtextextended('renavam:' || v_value, 0));
    end if;
    if v_value <> '' and exists (
      select 1 from public.veiculos v
      where v.id <> coalesce(new.id, -1)
        and regexp_replace(upper(coalesce(v.renavam, '')), '[^A-Z0-9]', '', 'g') = v_value
    ) then
      raise exception 'RENAVAM já cadastrado em outra frota' using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;
