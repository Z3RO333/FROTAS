CREATE TABLE IF NOT EXISTS numero_fogo_sequencia (
  chave_frota text NOT NULL,
  digito_ano text NOT NULL,
  proxima_contagem integer NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chave_frota, digito_ano)
);

CREATE OR REPLACE FUNCTION reservar_contagens_numero_fogo(
  p_chave_frota text,
  p_digito_ano text,
  p_quantidade integer
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_baseline integer;
  v_inicio integer;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'p_quantidade deve ser positivo' USING ERRCODE = '22023';
  END IF;
  IF p_chave_frota IS NULL OR p_chave_frota = '' THEN
    RAISE EXCEPTION 'p_chave_frota é obrigatório' USING ERRCODE = '22023';
  END IF;
  IF p_digito_ano IS NULL OR p_digito_ano = '' THEN
    RAISE EXCEPTION 'p_digito_ano é obrigatório' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(MAX(contagem), 0) + 1 INTO v_baseline
  FROM numero_fogo
  WHERE ultimo_digito_ano = p_digito_ano
    AND frota = p_chave_frota;

  INSERT INTO numero_fogo_sequencia (chave_frota, digito_ano, proxima_contagem)
  VALUES (p_chave_frota, p_digito_ano, v_baseline + p_quantidade)
  ON CONFLICT (chave_frota, digito_ano) DO UPDATE
  SET
    proxima_contagem = GREATEST(numero_fogo_sequencia.proxima_contagem, v_baseline) + p_quantidade,
    atualizado_em = now()
  RETURNING proxima_contagem - p_quantidade INTO v_inicio;

  RETURN v_inicio;
END;
$$;

INSERT INTO numero_fogo_sequencia (chave_frota, digito_ano, proxima_contagem)
SELECT frota, ultimo_digito_ano, MAX(contagem) + 1
FROM numero_fogo
WHERE frota IS NOT NULL AND ultimo_digito_ano IS NOT NULL
GROUP BY frota, ultimo_digito_ano
ON CONFLICT (chave_frota, digito_ano) DO UPDATE
SET proxima_contagem = GREATEST(numero_fogo_sequencia.proxima_contagem, EXCLUDED.proxima_contagem);;
