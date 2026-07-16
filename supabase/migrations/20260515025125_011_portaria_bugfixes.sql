
-- Adiciona coluna data_movimentacao (date, preenchida pelo app na inserção)
ALTER TABLE public.movimentacoes_frota
  ADD COLUMN IF NOT EXISTS data_movimentacao date;

-- Backfill de registros existentes com a data UTC do data_hora
UPDATE public.movimentacoes_frota
  SET data_movimentacao = (data_hora AT TIME ZONE 'UTC')::date
  WHERE data_movimentacao IS NULL;

-- Unique index: previne dupla saída/entrada do mesmo veículo no mesmo dia
DROP INDEX IF EXISTS public.uq_movimento_frota_tipo_dia;

CREATE UNIQUE INDEX uq_movimento_frota_tipo_dia
  ON public.movimentacoes_frota (frota_id, tipo_movimentacao, data_movimentacao);

-- Índice para queries de portaria do dia
CREATE INDEX IF NOT EXISTS idx_movimentacoes_frota_data_hora
  ON public.movimentacoes_frota (data_hora DESC);

-- Índice para histórico por frota
CREATE INDEX IF NOT EXISTS idx_movimentacoes_frota_frota_id
  ON public.movimentacoes_frota (frota_id, data_hora DESC);

-- Índice para KM pendente de validação
CREATE INDEX IF NOT EXISTS idx_historico_km_nao_validado
  ON public.historico_km_frota (validado, criado_em DESC)
  WHERE validado = false;

-- Índice para eventos de veículo por tipo
CREATE INDEX IF NOT EXISTS idx_veiculo_eventos_tipo
  ON public.veiculo_eventos (veiculo_id, tipo_evento, criado_em DESC);
;
