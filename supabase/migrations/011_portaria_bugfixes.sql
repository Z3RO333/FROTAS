-- Migration 011: Portaria — previne dupla movimentação e adiciona índices de performance

-- Constraint única: um veículo não pode ter dois registros do mesmo tipo no mesmo dia
-- Previne race condition onde duas telas de portaria registram SAIDA simultaneamente
--
-- Problema: data_hora::date usa timezone da sessão → STABLE (não IMMUTABLE).
-- Solução: coluna gerada com extract(epoch)/86400 → número do dia UTC, genuinamente IMMUTABLE.
ALTER TABLE public.movimentacoes_frota
  ADD COLUMN IF NOT EXISTS utc_dia integer
  GENERATED ALWAYS AS (((extract(epoch from data_hora)) / 86400)::integer) STORED;

DROP INDEX IF EXISTS public.uq_movimento_frota_tipo_dia;

CREATE UNIQUE INDEX uq_movimento_frota_tipo_dia
  ON public.movimentacoes_frota (frota_id, tipo_movimentacao, utc_dia);

-- Índice para queries de portaria do dia (listPortariaToday filtra por data_hora >= start AND < end)
CREATE INDEX IF NOT EXISTS idx_movimentacoes_frota_data_hora
  ON public.movimentacoes_frota (data_hora DESC);

-- Índice para consultas de histórico por frota
CREATE INDEX IF NOT EXISTS idx_movimentacoes_frota_frota_id
  ON public.movimentacoes_frota (frota_id, data_hora DESC);

-- Índice para km_validado = false (usado para consultas de KM pendente de validação)
CREATE INDEX IF NOT EXISTS idx_historico_km_nao_validado
  ON public.historico_km_frota (validado, criado_em DESC)
  WHERE validado = false;

-- Índice para eventos de veículo por tipo (usado em dashboards e filtros)
CREATE INDEX IF NOT EXISTS idx_veiculo_eventos_tipo
  ON public.veiculo_eventos (veiculo_id, tipo_evento, criado_em DESC);
