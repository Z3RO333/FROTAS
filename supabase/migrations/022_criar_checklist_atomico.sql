-- Migration 022: torna a criação de checklist atômica.
--
-- Bug original (lib/repos/checklists.ts createChecklist):
--   Supabase JS não tem transação, então o código fazia INSERTs sequenciais.
--   O INSERT de itens tinha rollback manual (delete do checklist), mas o de
--   pendências e o appendKmHistory NÃO. Uma falha após o checklist deixava
--   estado parcial: checklist sem pendência, ou checklist+itens sem histórico
--   de KM.
--
-- Fix: RPC que insere checklist + itens + pendências + histórico de KM numa
-- única transação (toda função plpgsql roda atomicamente — qualquer exceção
-- reverte tudo). A lógica de negócio (cálculo de status, gravidade, etc.)
-- permanece em JS; a RPC só persiste os dados já calculados.
--
-- Fora da RPC (mantidos em JS, recuperáveis pelo histórico): update de
-- km_atual do veículo e registro de abastecimento.

CREATE OR REPLACE FUNCTION criar_checklist_atomico(
  p_checklist jsonb,
  p_itens jsonb DEFAULT '[]'::jsonb,
  p_pendencias jsonb DEFAULT '[]'::jsonb,
  p_km_history jsonb DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_checklist_id bigint;
  v_item jsonb;
  v_pend jsonb;
BEGIN
  IF p_checklist IS NULL THEN
    RAISE EXCEPTION 'p_checklist é obrigatório' USING ERRCODE = '22023';
  END IF;

  -- 1. Checklist
  INSERT INTO checklists_frota (
    frota_id, motorista_id, motorista_nome, data_checklist,
    km_informado, km_lido_ocr, ocr_confianca, km_confirmado,
    foto_km_url, status_geral, observacao_original, observacao_corrigida_ia
  ) VALUES (
    (p_checklist->>'frota_id')::bigint,
    p_checklist->>'motorista_id',
    p_checklist->>'motorista_nome',
    COALESCE((p_checklist->>'data_checklist')::timestamptz, now()),
    NULLIF(p_checklist->>'km_informado', '')::bigint,
    NULLIF(p_checklist->>'km_lido_ocr', '')::bigint,
    NULLIF(p_checklist->>'ocr_confianca', '')::double precision,
    NULLIF(p_checklist->>'km_confirmado', '')::boolean,
    p_checklist->>'foto_km_url',
    p_checklist->>'status_geral',
    p_checklist->>'observacao_original',
    p_checklist->>'observacao_corrigida_ia'
  )
  RETURNING id INTO v_checklist_id;

  -- 2. Itens
  IF p_itens IS NOT NULL AND jsonb_typeof(p_itens) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
      INSERT INTO checklist_itens (
        checklist_id, item_codigo, item_nome, grupo, status,
        obrigatorio, critico, observacao, foto_url
      ) VALUES (
        v_checklist_id,
        v_item->>'item_codigo',
        v_item->>'item_nome',
        v_item->>'grupo',
        v_item->>'status',
        COALESCE((v_item->>'obrigatorio')::boolean, false),
        COALESCE((v_item->>'critico')::boolean, false),
        v_item->>'observacao',
        v_item->>'foto_url'
      );
    END LOOP;
  END IF;

  -- 3. Pendências
  IF p_pendencias IS NOT NULL AND jsonb_typeof(p_pendencias) = 'array' THEN
    FOR v_pend IN SELECT * FROM jsonb_array_elements(p_pendencias) LOOP
      INSERT INTO pendencias_frota (
        frota_id, checklist_id, item_nome, gravidade, status, responsavel_id, resolvido_em
      ) VALUES (
        (v_pend->>'frota_id')::bigint,
        v_checklist_id,
        v_pend->>'item_nome',
        v_pend->>'gravidade',
        COALESCE(NULLIF(v_pend->>'status', ''), 'ABERTA'),
        v_pend->>'responsavel_id',
        NULLIF(v_pend->>'resolvido_em', '')::timestamptz
      );
    END LOOP;
  END IF;

  -- 4. Histórico de KM
  IF p_km_history IS NOT NULL AND jsonb_typeof(p_km_history) = 'object' THEN
    INSERT INTO historico_km_frota (
      frota_id, checklist_id, motorista_id, motorista_nome,
      km_anterior, km_novo, diferenca_km, origem, foto_km_url,
      validado, validado_por, validado_em
    ) VALUES (
      (p_km_history->>'frota_id')::bigint,
      v_checklist_id,
      p_km_history->>'motorista_id',
      p_km_history->>'motorista_nome',
      NULLIF(p_km_history->>'km_anterior', '')::bigint,
      (p_km_history->>'km_novo')::bigint,
      NULLIF(p_km_history->>'diferenca_km', '')::bigint,
      p_km_history->>'origem',
      p_km_history->>'foto_km_url',
      COALESCE((p_km_history->>'validado')::boolean, false),
      p_km_history->>'validado_por',
      NULLIF(p_km_history->>'validado_em', '')::timestamptz
    );
  END IF;

  RETURN v_checklist_id;
END;
$$;
