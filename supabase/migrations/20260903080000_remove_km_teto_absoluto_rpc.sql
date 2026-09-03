-- Remove o teto absoluto de 20.000 km por turno da RPC register_checklist_frota.
-- O bloqueio foi substituído por um alerta que exige justificativa mas permite
-- o envio — necessário para viagens longas legítimas (ex: +24.000 km em turno
-- de redistribuição de frotas).
create or replace function public.register_checklist_frota(
  p_checklist jsonb,
  p_itens jsonb default null,
  p_abastecimento jsonb default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_submission_id text;
  v_frota_id      uuid;
  v_km_anterior   bigint;
  v_km_novo       bigint;
  v_checklist_id  uuid;
  v_abast_id      uuid;
  v_item          jsonb;
begin
  v_submission_id := p_checklist->>'submission_id';
  if exists (select 1 from public.checklists_frota where submission_id = v_submission_id) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  v_frota_id := (p_checklist->>'frota_id')::uuid;

  select km_atual into v_km_anterior
  from public.frotas
  where id = v_frota_id and ativo = true and vendido = false
  for update;
  if not found then
    raise exception 'Frota indisponível para checklist' using errcode = 'P0002';
  end if;

  -- Teto absoluto removido: saltos grandes agora são aceitos com justificativa
  -- (validados na camada TypeScript antes de chegar aqui).

  v_km_novo := nullif(p_checklist->>'km_informado', '')::bigint;

  insert into public.checklists_frota (
    submission_id, frota_id, motorista_id, motorista_nome, data_checklist,
    km_informado, km_lido_ocr, ocr_confianca, km_confirmado,
    foto_km_url, status_geral, observacao_original, observacao_corrigida_ia
  ) values (
    v_submission_id, v_frota_id, p_checklist->>'motorista_id',
    p_checklist->>'motorista_nome', coalesce((p_checklist->>'data_checklist')::timestamptz, now()),
    v_km_novo,
    nullif(p_checklist->>'km_lido_ocr', '')::bigint,
    nullif(p_checklist->>'ocr_confianca', '')::double precision,
    nullif(p_checklist->>'km_confirmado', '')::boolean,
    p_checklist->>'foto_km_url', p_checklist->>'status_geral',
    p_checklist->>'observacao_original', p_checklist->>'observacao_corrigida_ia'
  ) returning id into v_checklist_id;

  if p_itens is not null and jsonb_typeof(p_itens) = 'array' then
    for v_item in select * from jsonb_array_elements(p_itens) loop
      insert into public.checklists_frota_itens (
        checklist_id, codigo, status, observacao, foto_url
      ) values (
        v_checklist_id,
        v_item->>'codigo',
        v_item->>'status',
        nullif(v_item->>'observacao', ''),
        nullif(v_item->>'foto_url', '')
      );
    end loop;
  end if;

  if p_abastecimento is not null and (p_abastecimento->>'litros_combustivel') is not null then
    insert into public.abastecimentos (
      checklist_id, frota_id, tipo_combustivel, litros_combustivel, litros_arla,
      nivel_combustivel, nivel_arla
    ) values (
      v_checklist_id, v_frota_id,
      nullif(p_abastecimento->>'tipo_combustivel', ''),
      nullif(p_abastecimento->>'litros_combustivel', '')::integer,
      nullif(p_abastecimento->>'litros_arla', '')::integer,
      nullif(p_abastecimento->>'nivel_combustivel', '')::integer,
      nullif(p_abastecimento->>'nivel_arla', '')::integer
    ) returning id into v_abast_id;
  end if;

  if v_km_novo is not null then
    update public.frotas set km_atual = v_km_novo where id = v_frota_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'checklist_id', v_checklist_id,
    'abastecimento_id', v_abast_id
  );
end;
$$;
