-- 017_indices_frotas.sql
-- Adiciona índices para acelerar filtros frequentes em /frotas e dashboards.
-- Todos idempotentes — pode ser aplicado várias vezes sem efeito colateral.

-- Filtro por CD/local (chips de CD no /frotas e dashboard)
create index if not exists veiculos_local_idx
  on public.veiculos (local)
  where ativo = true and vendido = false;

-- Filtro por modelo (select de modelo)
create index if not exists veiculos_modelo_idx
  on public.veiculos (modelo)
  where ativo = true and vendido = false;

-- Filtro por ano de fabricação (idadeMin, ano)
create index if not exists veiculos_ano_fabricacao_idx
  on public.veiculos (ano_fabricacao)
  where ativo = true and vendido = false;

-- Composto para o hot path: listagem básica ordenada por id, filtros padrão
create index if not exists veiculos_ativo_vendido_id_idx
  on public.veiculos (ativo, vendido, id);
