-- Migration 014: Views de estatísticas e histórico por motorista

-- Adiciona campos de destino/motivo nas movimentações se ainda não existirem
ALTER TABLE public.movimentacoes_frota
  ADD COLUMN IF NOT EXISTS destino text,
  ADD COLUMN IF NOT EXISTS motivo text,
  ADD COLUMN IF NOT EXISTS tipo_destino text;

-- View: estatísticas por motorista
CREATE OR REPLACE VIEW public.v_motorista_stats AS
SELECT
  m.motorista_id,
  u.nome AS motorista_nome,
  COUNT(*)::integer AS total_movimentacoes,
  COUNT(DISTINCT m.frota_id)::integer AS frotas_distintas,
  MAX(m.data_hora) AS ultima_movimentacao,
  COUNT(*) FILTER (WHERE m.tipo_movimentacao = 'SAIDA')::integer AS total_saidas
FROM public.movimentacoes_frota m
LEFT JOIN public.usuarios u ON u.email = m.motorista_id
WHERE m.motorista_id IS NOT NULL
GROUP BY m.motorista_id, u.nome;

GRANT SELECT ON public.v_motorista_stats TO service_role;

-- View: histórico de frotas por motorista
CREATE OR REPLACE VIEW public.v_motorista_frotas AS
SELECT
  m.motorista_id,
  m.frota_id,
  v.codigo_frota AS frota_geral,
  v.placa,
  COUNT(*)::integer AS qtd_movimentacoes,
  MAX(m.data_hora) AS ultima_vez
FROM public.movimentacoes_frota m
JOIN public.veiculos v ON v.id = m.frota_id
WHERE m.motorista_id IS NOT NULL
GROUP BY m.motorista_id, m.frota_id, v.codigo_frota, v.placa;

GRANT SELECT ON public.v_motorista_frotas TO service_role;;
