begin;

create or replace function public.registrar_troca_pneu_atomica(
  p_servico jsonb,
  p_trocas jsonb,
  p_numeros_fogo jsonb
) returns text
language plpgsql
set search_path = public
as $$
declare
  v_id_servico text := p_servico->>'id_servico';
  v_total integer;
  v_distintas integer;
begin
  if p_servico is null or jsonb_typeof(p_servico) <> 'object'
     or p_trocas is null or jsonb_typeof(p_trocas) <> 'array'
     or p_numeros_fogo is null or jsonb_typeof(p_numeros_fogo) <> 'array' then
    raise exception 'Payload da troca de pneu inválido' using errcode = '22023';
  end if;
  if v_id_servico is null or btrim(v_id_servico) = '' then
    raise exception 'Identificador do serviço é obrigatório' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_id_servico, 0));
  if exists (select 1 from public.servicos_app where id_servico = v_id_servico) then
    return v_id_servico;
  end if;
  if nullif(btrim(p_servico->>'id_veiculo'), '') is null
     or nullif(p_servico->>'quilometragem', '')::numeric < 0 then
    raise exception 'Veículo e quilometragem válida são obrigatórios' using errcode = '22023';
  end if;

  select count(*), count(distinct upper(trim(item->>'posicao')))
  into v_total, v_distintas
  from jsonb_array_elements(p_trocas) as troca(item);
  if v_total = 0 or v_total <> v_distintas or exists (
    select 1 from jsonb_array_elements(p_trocas) as troca(item)
    where nullif(btrim(item->>'posicao'), '') is null
      or nullif(btrim(item->>'numero_fogo'), '') is null
  ) then
    raise exception 'As posições de pneu devem ser preenchidas e distintas' using errcode = '22023';
  end if;
  if jsonb_array_length(p_numeros_fogo) <> v_total or exists (
    select 1 from jsonb_array_elements(p_numeros_fogo) as fogo(item)
    where nullif(btrim(item->>'numero_fogo'), '') is null
      or nullif(item->>'contagem', '')::integer < 0
      or nullif(item->>'qtd_pneus', '')::integer <= 0
  ) then
    raise exception 'Números de fogo inválidos ou incompatíveis com as trocas' using errcode = '22023';
  end if;

  insert into public.servicos_app (
    id_servico, id_veiculo, tipo_servico, quilometragem, observacoes,
    registrado_por_email, registrado_por_nome
  ) values (
    v_id_servico, p_servico->>'id_veiculo', 'troca_pneu',
    nullif(p_servico->>'quilometragem', '')::numeric,
    p_servico->>'observacoes', p_servico->>'registrado_por_email',
    p_servico->>'registrado_por_nome'
  );

  insert into public.trocas_pneus_app (id_servico, posicao, numero_fogo, quilometragem)
  select v_id_servico, upper(btrim(item->>'posicao')), item->>'numero_fogo',
    nullif(item->>'quilometragem', '')::numeric
  from jsonb_array_elements(p_trocas) as troca(item);

  insert into public.numero_fogo (
    numero_fogo, contagem, data, mes, placa, frota,
    ultimo_digito_ano, qtd_pneus
  )
  select item->>'numero_fogo', (item->>'contagem')::integer,
    (item->>'data')::date, (item->>'mes')::integer,
    item->>'placa', item->>'frota', item->>'ultimo_digito_ano',
    (item->>'qtd_pneus')::integer
  from jsonb_array_elements(p_numeros_fogo) as fogo(item);

  return v_id_servico;
end;
$$;

revoke all on function public.registrar_troca_pneu_atomica(jsonb, jsonb, jsonb) from public;
grant execute on function public.registrar_troca_pneu_atomica(jsonb, jsonb, jsonb) to service_role;

commit;
