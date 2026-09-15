-- Sobe o teto absoluto de variação de KM por turno de 50.000 para 100.000 km,
-- nos dois sentidos (trigger já simétrico desde 20260915090000).

create or replace function public.valida_teto_km_por_turno()
returns trigger
language plpgsql
as $$
declare
  v_limite constant bigint := 100000;
  v_delta  bigint;
begin
  if new.km_anterior is null or new.km_novo is null then
    return new;
  end if;

  v_delta := new.km_novo - new.km_anterior;
  if abs(v_delta) > v_limite then
    raise exception
      'Variação de KM impossível: % km em um turno (de % para %). Confira os dígitos do hodômetro.',
      v_delta, new.km_anterior, new.km_novo
      using errcode = '22023';
  end if;

  return new;
end;
$$;
