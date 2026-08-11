-- Localização (CD/unidade) e setor são dados independentes da frota.
alter table public.veiculos
  add column if not exists setor text;

create index if not exists veiculos_setor_idx
  on public.veiculos (setor)
  where ativo = true and vendido = false and setor is not null;
