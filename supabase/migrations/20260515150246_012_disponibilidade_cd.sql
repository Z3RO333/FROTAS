-- Migration 012: View de disponibilidade por CD com agrupamento Tarumã

-- View: disponibilidade consolidada por CD
-- Regra de negócio: CD Tarumã fica agrupado com o CD-mãe
CREATE OR REPLACE VIEW public.v_disponibilidade_cd AS
SELECT
  CASE
    WHEN lower(v.local) LIKE '%taruma%' OR lower(v.local) LIKE '%tarumã%'
      THEN 'CD Manaus'
    ELSE COALESCE(v.local, 'Sem CD')
  END AS cd_nome,
  COUNT(*) FILTER (WHERE v.ativo = true AND v.vendido = false)::integer AS total,
  COUNT(*) FILTER (WHERE v.ativo = true AND v.vendido = false AND v.status = 'disponivel')::integer AS disponiveis,
  COUNT(*) FILTER (WHERE v.ativo = true AND v.vendido = false AND v.status = 'manutencao')::integer AS em_manutencao,
  COUNT(*) FILTER (WHERE v.ativo = true AND v.vendido = false AND (v.status = 'indisponivel' OR v.status IS NULL AND v.ativo = true))::integer AS paradas,
  ROUND(
    COUNT(*) FILTER (WHERE v.ativo = true AND v.vendido = false AND v.status = 'disponivel')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE v.ativo = true AND v.vendido = false), 0) * 100
  , 1) AS percentual_disponibilidade
FROM public.veiculos v
WHERE v.ativo = true AND v.vendido = false
GROUP BY 1
ORDER BY 1;

GRANT SELECT ON public.v_disponibilidade_cd TO service_role;;
