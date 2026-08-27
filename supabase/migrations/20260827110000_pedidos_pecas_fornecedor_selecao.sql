-- Permite escolher, por frota do lote, quais fornecedores recebem a cotação
-- (em vez de mandar sempre para todos os fornecedores ativos).

drop function if exists public.criar_pedido_pecas(uuid, bigint, jsonb, text, text, text, text);

create or replace function public.criar_pedido_pecas(
  p_token_idempotencia uuid,
  p_frota_id bigint,
  p_itens jsonb,
  p_observacao text,
  p_solicitante_nome text,
  p_solicitante_email text,
  p_copia_email text,
  p_fornecedor_ids bigint[]
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_frota public.veiculos%rowtype;
  v_pedido_id bigint;
  v_envios_criados integer;
begin
  select id into v_pedido_id
  from public.pedidos_pecas
  where token_idempotencia = p_token_idempotencia;

  if found then
    return v_pedido_id;
  end if;

  if jsonb_typeof(p_itens) is distinct from 'array'
    or jsonb_array_length(p_itens) < 1
    or jsonb_array_length(p_itens) > 25 then
    raise exception 'Informe entre 1 e 25 pecas.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_itens) item
    where nullif(btrim(item->>'descricao'), '') is null
      or item->>'quantidade' !~ '^[1-9][0-9]{0,2}$'
  ) then
    raise exception 'Revise a descricao e a quantidade das pecas.';
  end if;

  if p_fornecedor_ids is null or array_length(p_fornecedor_ids, 1) is null then
    raise exception 'Nenhum fornecedor selecionado para cotacao.';
  end if;

  select * into v_frota
  from public.veiculos
  where id = p_frota_id and ativo = true and vendido = false;

  if not found then
    raise exception 'Frota nao encontrada ou inativa.';
  end if;

  insert into public.pedidos_pecas (
    token_idempotencia,
    frota_id,
    frota_codigo,
    placa,
    modelo,
    chassi,
    ano_fabricacao,
    observacao,
    solicitante_nome,
    solicitante_email
  ) values (
    p_token_idempotencia,
    v_frota.id,
    coalesce(v_frota.codigo_frota, v_frota.placa, v_frota.id::text),
    v_frota.placa,
    v_frota.modelo,
    v_frota.chassi,
    v_frota.ano_fabricacao,
    nullif(btrim(p_observacao), ''),
    btrim(p_solicitante_nome),
    lower(btrim(p_solicitante_email))
  ) returning id into v_pedido_id;

  insert into public.pedido_pecas_itens (pedido_id, ordem, descricao, quantidade)
  select
    v_pedido_id,
    item_ordem::integer,
    btrim(item->>'descricao'),
    (item->>'quantidade')::integer
  from jsonb_array_elements(p_itens) with ordinality as itens(item, item_ordem);

  insert into public.pedido_pecas_envios (
    pedido_id,
    fornecedor_nome,
    fornecedor_email,
    copia_email
  )
  select
    v_pedido_id,
    nome,
    lower(email),
    lower(btrim(p_copia_email))
  from public.fornecedores_pecas
  where ativo = true and id = any(p_fornecedor_ids)
  order by ordem, id;

  get diagnostics v_envios_criados = row_count;
  if v_envios_criados = 0 then
    raise exception 'Nenhum fornecedor selecionado esta ativo.';
  end if;

  return v_pedido_id;
end;
$$;

revoke all on function public.criar_pedido_pecas(uuid, bigint, jsonb, text, text, text, text, bigint[]) from public;
grant execute on function public.criar_pedido_pecas(uuid, bigint, jsonb, text, text, text, text, bigint[]) to service_role;
