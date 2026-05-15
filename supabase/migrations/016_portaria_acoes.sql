-- Migration 016: Ações da portaria além de SAIDA/ENTRADA

ALTER TABLE public.movimentacoes_frota
  ADD COLUMN IF NOT EXISTS tipo_acao text
    CHECK (tipo_acao IN ('SAIDA','ENTRADA','BLOQUEIO','SOLICITACAO_CORRECAO','OBSERVACAO'))
    DEFAULT 'SAIDA',
  ADD COLUMN IF NOT EXISTS motivo_bloqueio text;

-- Preenche tipo_acao nos registros existentes com base em tipo_movimentacao
UPDATE public.movimentacoes_frota
  SET tipo_acao = tipo_movimentacao
  WHERE tipo_acao IS NULL OR tipo_acao = 'SAIDA';

-- Índice para busca de histórico por frota + ação
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo_acao
  ON public.movimentacoes_frota (frota_id, tipo_acao, data_hora DESC);
