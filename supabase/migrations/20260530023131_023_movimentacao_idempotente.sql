CREATE OR REPLACE FUNCTION registrar_movimentacao_idempotente(
  p_frota_id bigint,
  p_motorista_id text,
  p_checklist_id bigint,
  p_tipo_movimentacao text,
  p_usuario_portaria_id text,
  p_observacao text DEFAULT NULL,
  p_tipo_acao text DEFAULT NULL,
  p_motivo_bloqueio text DEFAULT NULL,
  p_janela_segundos integer DEFAULT 10
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_id bigint;
  v_tipo_acao text;
BEGIN
  v_tipo_acao := COALESCE(p_tipo_acao, p_tipo_movimentacao);

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_frota_id::text || ':' || COALESCE(p_checklist_id::text, ''), 0)
  );

  SELECT id INTO v_id
  FROM movimentacoes_frota
  WHERE frota_id = p_frota_id
    AND checklist_id IS NOT DISTINCT FROM p_checklist_id
    AND tipo_movimentacao = p_tipo_movimentacao
    AND COALESCE(tipo_acao, tipo_movimentacao) = v_tipo_acao
    AND data_hora >= now() - make_interval(secs => p_janela_segundos)
  ORDER BY id DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO movimentacoes_frota (
    frota_id, motorista_id, checklist_id, tipo_movimentacao,
    data_hora, data_movimentacao, usuario_portaria_id, observacao,
    tipo_acao, motivo_bloqueio
  ) VALUES (
    p_frota_id, p_motorista_id, p_checklist_id, p_tipo_movimentacao,
    now(), (now() AT TIME ZONE 'UTC')::date, p_usuario_portaria_id, p_observacao,
    v_tipo_acao, p_motivo_bloqueio
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;;
