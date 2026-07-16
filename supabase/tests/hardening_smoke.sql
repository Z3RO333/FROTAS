-- Database smoke tests for the reliability hardening migrations.
-- Every write is rolled back at the end.
begin;

do $$
declare
  v_vehicle_id bigint;
  v_km bigint;
  v_submission uuid := gen_random_uuid();
  v_first jsonb;
  v_second jsonb;
begin
  select id, coalesce(km_atual, 0)
    into v_vehicle_id, v_km
    from public.veiculos
   where ativo = true and vendido = false
   order by id
   limit 1;
  if v_vehicle_id is null then
    raise exception 'Smoke test requires one active vehicle';
  end if;

  v_first := public.criar_checklist_atomico_v2(
    jsonb_build_object(
      'submission_id', v_submission,
      'frota_id', v_vehicle_id,
      'motorista_id', 'migration-smoke',
      'motorista_nome', 'Migration Smoke',
      'km_informado', v_km,
      'km_confirmado', true,
      'status_geral', 'OK'
    ),
    jsonb_build_array(jsonb_build_object(
      'item_codigo', 'SMOKE_ITEM',
      'item_nome', 'Smoke item',
      'grupo', 'SMOKE',
      'status', 'APTO',
      'obrigatorio', true,
      'critico', false
    )),
    '[]'::jsonb,
    jsonb_build_object('km_novo', v_km, 'origem', 'MANUAL', 'validado', true),
    '{}'::jsonb,
    jsonb_build_object(
      'km_atual', v_km,
      'km_origem', 'MANUAL',
      'km_validado', true,
      'status_operacional', 'LIBERADA'
    )
  );

  v_second := public.criar_checklist_atomico_v2(
    jsonb_build_object(
      'submission_id', v_submission,
      'frota_id', v_vehicle_id,
      'motorista_id', 'migration-smoke',
      'motorista_nome', 'Migration Smoke',
      'km_informado', v_km,
      'km_confirmado', true,
      'status_geral', 'OK'
    ),
    jsonb_build_array(jsonb_build_object(
      'item_codigo', 'SMOKE_ITEM', 'item_nome', 'Smoke item',
      'grupo', 'SMOKE', 'status', 'APTO', 'obrigatorio', true, 'critico', false
    )),
    '[]'::jsonb,
    jsonb_build_object('km_novo', v_km, 'origem', 'MANUAL', 'validado', true),
    '{}'::jsonb,
    jsonb_build_object('km_atual', v_km, 'km_origem', 'MANUAL', 'km_validado', true)
  );

  if v_first->>'created' <> 'true'
     or v_second->>'created' <> 'false'
     or v_first->>'checklist_id' is distinct from v_second->>'checklist_id' then
    raise exception 'Checklist idempotency smoke test failed';
  end if;

  begin
    perform public.criar_checklist_atomico_v2(null, '[]'::jsonb, '[]'::jsonb, null, null, null);
    raise exception 'Invalid checklist payload was accepted';
  exception when sqlstate '22023' then
    null;
  end;
end $$;

do $$
declare
  v_service_id text := gen_random_uuid()::text;
  v_vehicle_code text;
  v_fire text := 'SMK' || replace(gen_random_uuid()::text, '-', '');
  v_first text;
  v_second text;
begin
  select codigo_frota into v_vehicle_code
    from public.veiculos
   where ativo = true and vendido = false and codigo_frota is not null
   order by id limit 1;
  if v_vehicle_code is null then
    raise exception 'Smoke test requires one vehicle code';
  end if;

  v_first := public.registrar_troca_pneu_atomica(
    jsonb_build_object(
      'id_servico', v_service_id, 'id_veiculo', v_vehicle_code,
      'quilometragem', 0, 'registrado_por_email', 'smoke@example.invalid',
      'registrado_por_nome', 'Migration Smoke'
    ),
    jsonb_build_array(jsonb_build_object(
      'posicao', 'SMOKE', 'numero_fogo', v_fire, 'quilometragem', 0
    )),
    jsonb_build_array(jsonb_build_object(
      'numero_fogo', v_fire, 'contagem', 0, 'data', current_date,
      'mes', extract(month from current_date)::integer, 'frota', v_vehicle_code,
      'ultimo_digito_ano', right(extract(year from current_date)::text, 1), 'qtd_pneus', 1
    ))
  );
  v_second := public.registrar_troca_pneu_atomica(
    jsonb_build_object('id_servico', v_service_id), '[]'::jsonb, '[]'::jsonb
  );
  if v_first <> v_service_id or v_second <> v_service_id then
    raise exception 'Tire replacement idempotency smoke test failed';
  end if;
end $$;

do $$
declare
  v_vehicle_id bigint;
  v_pending_id bigint;
  v_result jsonb;
begin
  select id into v_vehicle_id from public.veiculos order by id limit 1;
  insert into public.pendencias_frota (frota_id, item_nome, gravidade, status)
  values (v_vehicle_id, 'Smoke pending item', 'CRITICA', 'ABERTA')
  returning id into v_pending_id;

  v_result := public.resolver_pendencia_atomica(v_pending_id, 'migration-smoke', false);
  if v_result->>'pendencia_id' <> v_pending_id::text
     or (select status from public.pendencias_frota where id = v_pending_id) <> 'RESOLVIDA' then
    raise exception 'Atomic pending resolution smoke test failed';
  end if;
end $$;

do $$
declare
  v_key text := 'migration-smoke:' || gen_random_uuid()::text;
begin
  if not public.consume_api_rate_limit(v_key, 1, 60) then
    raise exception 'First rate-limit request should be accepted';
  end if;
  if public.consume_api_rate_limit(v_key, 1, 60) then
    raise exception 'Second rate-limit request should be rejected';
  end if;
end $$;

-- Claim functions must accept an empty queue without failing.
select count(*) >= 0 as checklist_claim_ok from public.claim_checklists_analise(1, -1);
select count(*) >= 0 as image_claim_ok from public.claim_checklist_image_inspections(1);
select count(*) >= 0 as schedule_claim_ok from public.claim_email_schedules(1, null, null);

rollback;
