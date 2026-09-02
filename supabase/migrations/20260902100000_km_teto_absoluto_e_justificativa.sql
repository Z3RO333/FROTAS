-- Fecha a brecha que permitiu o checklist 584 (frota 112) gravar 233.363.362 km.
--
-- O campo de KM chega pré-preenchido com a leitura da IA; o motorista digitou
-- por cima e os dígitos concatenaram (233363 + 362). A validação só exigia
-- justificativa em texto livre para saltos grandes, então qualquer texto
-- autorizava qualquer valor — e o número sobrescreveu o km_atual da frota,
-- passando a invalidar toda leitura futura do hodômetro dela.
--
-- Duas mudanças:
--   1. justificativa_km passa a ser persistida no histórico de KM. Antes era
--      descartada, então o texto que autorizava a divergência não deixava rastro.
--   2. Teto absoluto de 20.000 km por turno dentro da própria RPC, sem escape
--      por justificativa. A regra também vive em lib/checklists/rules.ts, mas
--      aqui é a última camada antes do UPDATE em veiculos.km_atual.

begin;

alter table public.historico_km_frota
  add column if not exists justificativa_km text;

create or replace function public.criar_checklist_atomico_v2(
  p_checklist jsonb,
  p_itens jsonb default '[]'::jsonb,
  p_pendencias jsonb default '[]'::jsonb,
  p_km_history jsonb default null,
  p_abastecimento jsonb default null,
  p_vehicle_summary jsonb default null
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_checklist_id bigint;
  v_abastecimento_id bigint;
  v_frota_id bigint;
  v_submission_id uuid;
  v_km_anterior bigint;
  v_km_novo bigint;
  v_km_resumo bigint;
  v_item jsonb;
  v_pend jsonb;
begin
  if p_checklist is null or jsonb_typeof(p_checklist) <> 'object' then
    raise exception 'p_checklist é obrigatório' using errcode = '22023';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'p_itens deve ser uma lista não vazia' using errcode = '22023';
  end if;
  if p_pendencias is null or jsonb_typeof(p_pendencias) <> 'array' then
    raise exception 'p_pendencias deve ser uma lista' using errcode = '22023';
  end if;
  if p_km_history is null or jsonb_typeof(p_km_history) <> 'object' then
    raise exception 'p_km_history é obrigatório' using errcode = '22023';
  end if;
  if p_vehicle_summary is null or jsonb_typeof(p_vehicle_summary) <> 'object' then
    raise exception 'p_vehicle_summary é obrigatório' using errcode = '22023';
  end if;
  if p_abastecimento is not null and jsonb_typeof(p_abastecimento) <> 'object' then
    raise exception 'p_abastecimento deve ser um objeto' using errcode = '22023';
  end if;
  if nullif(btrim(p_checklist->>'motorista_id'), '') is null
     or nullif(btrim(p_checklist->>'motorista_nome'), '') is null then
    raise exception 'Motorista é obrigatório' using errcode = '22023';
  end if;

  v_frota_id := (p_checklist->>'frota_id')::bigint;
  v_submission_id := (p_checklist->>'submission_id')::uuid;
  if v_submission_id is null then
    raise exception 'submission_id é obrigatório' using errcode = '22023';
  end if;

  v_km_novo := nullif(p_km_history->>'km_novo', '')::bigint;
  v_km_resumo := nullif(p_vehicle_summary->>'km_atual', '')::bigint;
  if v_km_novo is null or v_km_novo < 0 or v_km_resumo is distinct from v_km_novo then
    raise exception 'Quilometragem inválida ou inconsistente' using errcode = '22023';
  end if;
  if nullif(p_vehicle_summary->>'nivel_combustivel', '')::integer not between 0 and 4
     or nullif(p_vehicle_summary->>'nivel_arla', '')::integer not between 0 and 4
     or nullif(p_vehicle_summary->>'litros_combustivel', '')::double precision < 0
     or nullif(p_abastecimento->>'litros_combustivel', '')::double precision < 0
     or nullif(p_abastecimento->>'litros_arla', '')::double precision < 0 then
    raise exception 'Níveis e volumes não podem estar fora dos limites' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_itens) as item(value)
    group by upper(btrim(value->>'item_codigo'))
    having nullif(upper(btrim(value->>'item_codigo')), '') is null or count(*) > 1
  ) then
    raise exception 'Itens do checklist devem ter códigos preenchidos e distintos' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_submission_id::text, 0));
  select id into v_checklist_id
  from public.checklists_frota
  where submission_id = v_submission_id;
  if v_checklist_id is not null then
    select id into v_abastecimento_id
    from public.abastecimentos_frota
    where checklist_id = v_checklist_id
    order by id desc limit 1;
    return jsonb_build_object(
      'checklist_id', v_checklist_id,
      'abastecimento_id', v_abastecimento_id,
      'created', false
    );
  end if;

  select km_atual into v_km_anterior
  from public.veiculos
  where id = v_frota_id and ativo = true and vendido = false
  for update;
  if not found then
    raise exception 'Frota indisponível para checklist' using errcode = 'P0002';
  end if;

  -- Teto absoluto, não liberável por justificativa. É a última barreira antes
  -- de km_atual ser sobrescrito: acima disso o número é erro de digitação.
  if v_km_anterior is not null and v_km_novo - v_km_anterior > 20000 then
    raise exception 'Salto de quilometragem impossível: % km acima do último registrado (%)',
      v_km_novo - v_km_anterior, v_km_anterior using errcode = '22023';
  end if;

  insert into public.checklists_frota (
    submission_id, frota_id, motorista_id, motorista_nome, data_checklist,
    km_informado, km_lido_ocr, ocr_confianca, km_confirmado,
    foto_km_url, status_geral, observacao_original, observacao_corrigida_ia
  ) values (
    v_submission_id, v_frota_id, p_checklist->>'motorista_id',
    p_checklist->>'motorista_nome', coalesce((p_checklist->>'data_checklist')::timestamptz, now()),
    nullif(p_checklist->>'km_informado', '')::bigint,
    nullif(p_checklist->>'km_lido_ocr', '')::bigint,
    nullif(p_checklist->>'ocr_confianca', '')::double precision,
    nullif(p_checklist->>'km_confirmado', '')::boolean,
    p_checklist->>'foto_km_url', p_checklist->>'status_geral',
    p_checklist->>'observacao_original', p_checklist->>'observacao_corrigida_ia'
  ) returning id into v_checklist_id;

  if p_itens is not null and jsonb_typeof(p_itens) = 'array' then
    for v_item in select * from jsonb_array_elements(p_itens) loop
      insert into public.checklist_itens (
        checklist_id, item_codigo, item_nome, grupo, status,
        obrigatorio, critico, observacao, foto_url
      ) values (
        v_checklist_id, v_item->>'item_codigo', v_item->>'item_nome',
        v_item->>'grupo', v_item->>'status',
        coalesce((v_item->>'obrigatorio')::boolean, false),
        coalesce((v_item->>'critico')::boolean, false),
        v_item->>'observacao', v_item->>'foto_url'
      );
    end loop;
  end if;

  if p_pendencias is not null and jsonb_typeof(p_pendencias) = 'array' then
    for v_pend in select * from jsonb_array_elements(p_pendencias) loop
      insert into public.pendencias_frota (
        frota_id, checklist_id, item_nome, gravidade, status, responsavel_id, resolvido_em
      ) values (
        v_frota_id, v_checklist_id, v_pend->>'item_nome', v_pend->>'gravidade',
        coalesce(nullif(v_pend->>'status', ''), 'ABERTA'),
        v_pend->>'responsavel_id', nullif(v_pend->>'resolvido_em', '')::timestamptz
      );
    end loop;
  end if;

  insert into public.historico_km_frota (
    frota_id, checklist_id, motorista_id, motorista_nome,
    km_anterior, km_novo, diferenca_km, origem, foto_km_url,
    validado, validado_por, validado_em, justificativa_km
  ) values (
    v_frota_id, v_checklist_id, p_checklist->>'motorista_id',
    p_checklist->>'motorista_nome', v_km_anterior,
    v_km_novo,
    case when v_km_anterior is null then null
      else v_km_novo - v_km_anterior end,
    p_km_history->>'origem', p_km_history->>'foto_km_url',
    coalesce((p_km_history->>'validado')::boolean, false),
    p_km_history->>'validado_por', nullif(p_km_history->>'validado_em', '')::timestamptz,
    nullif(btrim(p_km_history->>'justificativa_km'), '')
  );

  if p_abastecimento is not null and (
    coalesce(nullif(p_abastecimento->>'litros_combustivel', '')::double precision, 0) > 0
    or coalesce(nullif(p_abastecimento->>'litros_arla', '')::double precision, 0) > 0
  ) then
    insert into public.abastecimentos_frota (
      frota_id, motorista_id, motorista_nome, checklist_id, tipo_combustivel,
      litros_combustivel, litros_arla, km_no_abastecimento,
      foto_comprovante_url, origem
    ) values (
      v_frota_id, p_abastecimento->>'motorista_id', p_abastecimento->>'motorista_nome',
      v_checklist_id, p_abastecimento->>'tipo_combustivel',
      nullif(p_abastecimento->>'litros_combustivel', '')::double precision,
      nullif(p_abastecimento->>'litros_arla', '')::double precision,
      nullif(p_abastecimento->>'km_no_abastecimento', '')::bigint,
      p_abastecimento->>'foto_comprovante_url', 'CHECKLIST'
    ) returning id into v_abastecimento_id;
  end if;

  if coalesce(nullif(p_vehicle_summary->>'litros_combustivel', '')::double precision, 0) > 0
     or coalesce(nullif(p_vehicle_summary->>'nivel_combustivel', '')::integer, 0) > 0 then
    insert into public.veiculo_combustivel_historico (
      veiculo_id, checklist_id, litros, nivel_relativo, origem, usuario_id
    ) values (
      v_frota_id, v_checklist_id,
      nullif(p_vehicle_summary->>'litros_combustivel', '')::double precision,
      nullif(p_vehicle_summary->>'nivel_combustivel', '')::integer,
      case when coalesce(nullif(p_vehicle_summary->>'litros_combustivel', '')::double precision, 0) > 0
        then 'checklist_abastecimento' else 'checklist_nivel' end,
      p_vehicle_summary->>'motorista_id'
    );
  end if;

  if coalesce(nullif(p_vehicle_summary->>'nivel_arla', '')::integer, 0) > 0 then
    insert into public.veiculo_arla_historico (
      veiculo_id, checklist_id, nivel_relativo, origem, usuario_id
    ) values (
      v_frota_id, v_checklist_id,
      (p_vehicle_summary->>'nivel_arla')::integer,
      'checklist_nivel', p_vehicle_summary->>'motorista_id'
    );
  end if;

  update public.veiculos
  set km_atual = v_km_novo,
      km_atualizado_em = now(),
      km_origem = p_vehicle_summary->>'km_origem',
      km_validado = coalesce((p_vehicle_summary->>'km_validado')::boolean, false),
      ultimo_checklist_id = v_checklist_id,
      ultimo_checklist_em = now(),
      ultimo_motorista_id = p_checklist->>'motorista_id',
      ultimo_motorista_nome = p_checklist->>'motorista_nome',
      status = coalesce(nullif(p_vehicle_summary->>'status', ''), status),
      status_operacional = coalesce(nullif(p_vehicle_summary->>'status_operacional', ''), status_operacional),
      ultimo_abastecimento_em = case when v_abastecimento_id is null then ultimo_abastecimento_em else now() end,
      ultimo_abastecimento_litros = case when v_abastecimento_id is null then ultimo_abastecimento_litros
        else nullif(p_abastecimento->>'litros_combustivel', '')::double precision end,
      combustivel_atual_litros = case
        when nullif(p_vehicle_summary->>'litros_combustivel', '') is null then combustivel_atual_litros
        else (p_vehicle_summary->>'litros_combustivel')::double precision end,
      combustivel_atual_nivel = case
        when nullif(p_vehicle_summary->>'nivel_combustivel', '') is null then combustivel_atual_nivel
        else (p_vehicle_summary->>'nivel_combustivel')::integer end,
      combustivel_atualizado_em = case
        when nullif(p_vehicle_summary->>'litros_combustivel', '') is not null
          or nullif(p_vehicle_summary->>'nivel_combustivel', '') is not null then now()
        else combustivel_atualizado_em end,
      combustivel_origem = case
        when nullif(p_vehicle_summary->>'litros_combustivel', '') is not null then 'checklist_abastecimento'
        when nullif(p_vehicle_summary->>'nivel_combustivel', '') is not null then 'checklist_nivel'
        else combustivel_origem end,
      arla_atual_nivel = case
        when nullif(p_vehicle_summary->>'nivel_arla', '') is null then arla_atual_nivel
        else (p_vehicle_summary->>'nivel_arla')::integer end,
      arla_atualizado_em = case when nullif(p_vehicle_summary->>'nivel_arla', '') is null
        then arla_atualizado_em else now() end,
      arla_origem = case when nullif(p_vehicle_summary->>'nivel_arla', '') is null
        then arla_origem else 'checklist_nivel' end,
      atualizado_por = p_checklist->>'motorista_id'
  where id = v_frota_id;

  return jsonb_build_object(
    'checklist_id', v_checklist_id,
    'abastecimento_id', v_abastecimento_id,
    'created', true
  );
end;
$$;

revoke all on function public.criar_checklist_atomico_v2(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.criar_checklist_atomico_v2(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

commit;
