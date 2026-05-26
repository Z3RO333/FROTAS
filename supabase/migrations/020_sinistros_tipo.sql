alter table public.sinistros_frota
add column if not exists tipo_sinistro text not null default 'veiculo';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sinistros_frota_tipo_sinistro_check'
  ) then
    alter table public.sinistros_frota
    add constraint sinistros_frota_tipo_sinistro_check
    check (tipo_sinistro in ('veiculo', 'casa'));
  end if;
end $$;
