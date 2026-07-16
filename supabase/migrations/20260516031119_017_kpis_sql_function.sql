
-- Migration 017: Função SQL para KPIs de frotas
-- Substitui allFrotas() + filtros JS por uma única agregação no banco
-- Reduz de ~300 rows transferidas para 1 JSON com 13 valores

CREATE OR REPLACE FUNCTION public.get_frotas_kpis()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'total_ativos',
      COUNT(*) FILTER (WHERE ativo = true AND vendido = false),

    'total_disponiveis',
      COUNT(*) FILTER (WHERE ativo = true AND vendido = false
        AND status NOT IN ('manutencao', 'critico', 'vendido')),

    'total_indisponiveis',
      COUNT(*) FILTER (WHERE ativo = true AND vendido = false
        AND status IN ('manutencao', 'critico')),

    'total_manutencao',
      COUNT(*) FILTER (WHERE ativo = true AND vendido = false
        AND status = 'manutencao'),

    'total_manutencao_atrasada',
      COUNT(*) FILTER (WHERE ativo = true AND vendido = false
        AND status = 'manutencao'
        AND manutencao_prev_retorno IS NOT NULL
        AND manutencao_prev_retorno::date < CURRENT_DATE),

    'total_manutencao_longa',
      COUNT(*) FILTER (WHERE ativo = true AND vendido = false
        AND status = 'manutencao'
        AND manutencao_iniciado_em IS NOT NULL
        AND manutencao_iniciado_em < NOW() - INTERVAL '7 days'),

    'total_sem_km',
      COUNT(*) FILTER (WHERE ativo = true AND vendido = false
        AND km_atual IS NULL),

    'total_acima_7',
      COUNT(*) FILTER (WHERE ativo = true AND vendido = false
        AND ano_fabricacao IS NOT NULL
        AND (EXTRACT(YEAR FROM NOW())::int - ano_fabricacao) >= 7),

    'total_critico',
      COUNT(*) FILTER (WHERE ativo = true AND vendido = false AND (
        (ano_fabricacao IS NOT NULL AND (EXTRACT(YEAR FROM NOW())::int - ano_fabricacao) >= 10)
        OR status = 'critico'
      )),

    'total_atencao',
      COUNT(*) FILTER (WHERE ativo = true AND vendido = false
        AND NOT (
          (ano_fabricacao IS NOT NULL AND (EXTRACT(YEAR FROM NOW())::int - ano_fabricacao) >= 10)
          OR status = 'critico'
        )
        AND (
          (ano_fabricacao IS NOT NULL AND (EXTRACT(YEAR FROM NOW())::int - ano_fabricacao) >= 7)
          OR status = 'manutencao'
          OR (placa IS NULL OR chassi IS NULL OR renavam IS NULL
              OR modelo IS NULL OR ano_fabricacao IS NULL OR local IS NULL)
        )
      ),

    'total_cadastro_incompleto',
      COUNT(*) FILTER (WHERE ativo = true AND vendido = false AND (
        placa IS NULL OR chassi IS NULL OR renavam IS NULL
        OR modelo IS NULL OR ano_fabricacao IS NULL OR local IS NULL
      )),

    'idade_media',
      ROUND(AVG(EXTRACT(YEAR FROM NOW())::int - ano_fabricacao)
        FILTER (WHERE ativo = true AND vendido = false AND ano_fabricacao IS NOT NULL), 1),

    'km_medio',
      ROUND(AVG(km_atual)
        FILTER (WHERE ativo = true AND vendido = false AND km_atual IS NOT NULL))
  )
  FROM public.veiculos;
$$;

GRANT EXECUTE ON FUNCTION public.get_frotas_kpis() TO service_role;
;
