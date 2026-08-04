-- Remove a dependência de ENTRADA para liberar a frota e impede checklists
-- repetidos na mesma frota durante 15 minutos.
begin;

create or replace function public.registrar_movimentacao_idempotente(
  p_frota_id bigint,
  p_motorista_id text,
  p_checklist_id bigint,
  p_tipo_movimentacao text,
  p_usuario_portaria_id text,
  p_observacao text default null,
  p_tipo_acao text default null,
  p_motivo_bloqueio text default null,
  p_janela_segundos integer default 10
) returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_id bigint;
  v_tipo_acao text := coalesce(p_tipo_acao, p_tipo_movimentacao);
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_frota_id::text || ':' || coalesce(p_checklist_id::text, ''), 0)
  );

  select id into v_id
  from public.movimentacoes_frota
  where frota_id = p_frota_id
    and checklist_id is not distinct from p_checklist_id
    and tipo_movimentacao = p_tipo_movimentacao
    and coalesce(tipo_acao, tipo_movimentacao) = v_tipo_acao
    and data_hora >= now() - make_interval(secs => p_janela_segundos)
  order by id desc
  limit 1;

  if v_id is not null then return v_id; end if;

  insert into public.movimentacoes_frota (
    frota_id, motorista_id, checklist_id, tipo_movimentacao,
    data_hora, data_movimentacao, usuario_portaria_id, observacao,
    tipo_acao, motivo_bloqueio
  ) values (
    p_frota_id, p_motorista_id, p_checklist_id, p_tipo_movimentacao,
    now(), (now() at time zone 'America/Manaus')::date,
    p_usuario_portaria_id, p_observacao, v_tipo_acao, p_motivo_bloqueio
  ) returning id into v_id;

  -- A saída continua no histórico, mas não altera mais a disponibilidade do veículo.
  return v_id;
end;
$$;

revoke all on function public.registrar_movimentacao_idempotente(bigint, text, bigint, text, text, text, text, text, integer) from public;
grant execute on function public.registrar_movimentacao_idempotente(bigint, text, bigint, text, text, text, text, text, integer) to service_role;

-- Libera frotas que ficaram presas aguardando uma entrada.
update public.veiculos
set status_operacional = case
      when status = 'manutencao' then 'EM_MANUTENCAO'
      when status = 'critico' then 'BLOQUEADA_CHECKLIST'
      else 'DISPONIVEL'
    end
where status_operacional = 'SAIDA_REGISTRADA';

drop trigger if exists trg_prevent_checklist_for_vehicle_outside on public.checklists_frota;
drop function if exists public.prevent_checklist_for_vehicle_outside();

create or replace function public.prevent_checklist_during_cooldown()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ultimo_checklist_em timestamptz;
  v_minutos_restantes integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('checklist-cooldown:' || new.frota_id::text, 0)
  );

  select max(coalesce(criado_em, data_checklist)) into v_ultimo_checklist_em
  from public.checklists_frota
  where frota_id = new.frota_id;

  if v_ultimo_checklist_em > now() - interval '15 minutes' then
    v_minutos_restantes := greatest(
      1,
      ceil(extract(epoch from (v_ultimo_checklist_em + interval '15 minutes' - now())) / 60)::integer
    );
    raise exception 'Aguarde % minuto(s) para fazer outro checklist nesta frota.', v_minutos_restantes
      using errcode = 'P0002';
  end if;

  return new;
end;
$$;

create trigger trg_prevent_checklist_during_cooldown
before insert on public.checklists_frota
for each row execute function public.prevent_checklist_during_cooldown();

-- A saída registrada deixa de reduzir os KPIs de disponibilidade.
create or replace function public.get_frotas_kpis()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total_ativos',
      count(*) filter (where ativo = true and vendido = false),
    'total_disponiveis',
      count(*) filter (where ativo = true and vendido = false
        and status not in ('manutencao', 'critico', 'vendido')),
    'total_indisponiveis',
      count(*) filter (where ativo = true and vendido = false
        and status in ('manutencao', 'critico')),
    'total_manutencao',
      count(*) filter (where ativo = true and vendido = false and status = 'manutencao'),
    'total_manutencao_atrasada',
      count(*) filter (where ativo = true and vendido = false
        and status = 'manutencao'
        and manutencao_prev_retorno is not null
        and manutencao_prev_retorno::date < current_date),
    'total_manutencao_longa',
      count(*) filter (where ativo = true and vendido = false
        and status = 'manutencao'
        and manutencao_iniciado_em is not null
        and manutencao_iniciado_em < now() - interval '7 days'),
    'total_sem_km',
      count(*) filter (where ativo = true and vendido = false and km_atual is null),
    'total_acima_7',
      count(*) filter (where ativo = true and vendido = false
        and ano_fabricacao is not null
        and (extract(year from now())::int - ano_fabricacao) >= 7),
    'total_critico',
      count(*) filter (where ativo = true and vendido = false and (
        (ano_fabricacao is not null and (extract(year from now())::int - ano_fabricacao) >= 10)
        or status = 'critico'
      )),
    'total_atencao',
      count(*) filter (where ativo = true and vendido = false
        and not (
          (ano_fabricacao is not null and (extract(year from now())::int - ano_fabricacao) >= 10)
          or status = 'critico'
        )
        and (
          (ano_fabricacao is not null and (extract(year from now())::int - ano_fabricacao) >= 7)
          or status = 'manutencao'
          or (placa is null or chassi is null or renavam is null
              or modelo is null or ano_fabricacao is null or local is null)
        )
      ),
    'total_cadastro_incompleto',
      count(*) filter (where ativo = true and vendido = false and (
        placa is null or chassi is null or renavam is null
        or modelo is null or ano_fabricacao is null or local is null
      )),
    'idade_media',
      round(avg(extract(year from now())::int - ano_fabricacao)
        filter (where ativo = true and vendido = false and ano_fabricacao is not null), 1),
    'km_medio',
      round(avg(km_atual)
        filter (where ativo = true and vendido = false and km_atual is not null))
  )
  from public.veiculos;
$$;

grant execute on function public.get_frotas_kpis() to service_role;

commit;
