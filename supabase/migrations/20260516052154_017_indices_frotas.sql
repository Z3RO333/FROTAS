-- 017_indices_frotas.sql
-- Adiciona índices para acelerar filtros frequentes em /frotas e dashboards.

create index if not exists veiculos_local_idx
  on public.veiculos (local)
  where ativo = true and vendido = false;

create index if not exists veiculos_modelo_idx
  on public.veiculos (modelo)
  where ativo = true and vendido = false;

create index if not exists veiculos_ano_fabricacao_idx
  on public.veiculos (ano_fabricacao)
  where ativo = true and vendido = false;

create index if not exists veiculos_ativo_vendido_id_idx
  on public.veiculos (ativo, vendido, id);;
