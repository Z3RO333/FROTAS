-- Migration 023: previne movimentação de portaria duplicada por duplo-clique.
--
-- Bug original (lib/repos/checklists.ts registrarMovimentacaoFrota + actions):
--   As actions liam o estado via listPortariaToday() e inseriam sem lock. Dois
--   cliques (ou dois requests concorrentes) liam o mesmo estado liberado e
--   inseriam DUAS movimentações idênticas (ex.: duas SAÍDAS no mesmo instante).
--
-- Fix: RPC que serializa por frota via advisory lock de transação e descarta
-- duplicata idêntica dentro de uma janela curta (default 10s). Não usa unique
-- constraint rígida — SAÍDA real, BLOQUEIO e SOLICITAÇÃO_CORREÇÃO compartilham
-- tipo_movimentacao='SAIDA' e são distinguidos por tipo_acao; uma constraint
-- estática poderia bloquear sequências legítimas.

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
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_tipo_acao text;
BEGIN
  v_tipo_acao := COALESCE(p_tipo_acao, p_tipo_movimentacao);

  -- Serializa requests concorrentes para a mesma frota+checklist. O lock de
  -- transação é liberado automaticamente no fim da chamada (commit/rollback).
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_frota_id::text || ':' || COALESCE(p_checklist_id::text, ''), 0)
  );

  -- Já existe movimentação idêntica há poucos segundos? Trata como duplo-submit.
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
    RETURN v_id;  -- no-op idempotente
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
$$;
