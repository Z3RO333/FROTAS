-- Mantém o estado atual do veículo sincronizado com a movimentação física da portaria.
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
  perform pg_advisory_xact_lock(hashtextextended(p_frota_id::text || ':' || coalesce(p_checklist_id::text, ''), 0));

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

  if v_tipo_acao in ('SAIDA', 'LIBERACAO_FORCADA') then
    update public.veiculos
    set status_operacional = 'SAIDA_REGISTRADA',
        atualizado_por = p_usuario_portaria_id
    where id = p_frota_id;
  elsif v_tipo_acao = 'ENTRADA' then
    update public.veiculos
    set status_operacional = case
          when status = 'manutencao' then 'EM_MANUTENCAO'
          when status = 'critico' then 'BLOQUEADA_CHECKLIST'
          else 'DISPONIVEL'
        end,
        atualizado_por = p_usuario_portaria_id
    where id = p_frota_id;
  end if;

  return v_id;
end;
$$;

-- Corrige veículos que já saíram e ainda ficaram com LIBERADA/DISPONIVEL.
with ultima_movimentacao_fisica as (
  select distinct on (frota_id)
    frota_id,
    coalesce(tipo_acao, tipo_movimentacao) as tipo_acao,
    usuario_portaria_id
  from public.movimentacoes_frota
  where coalesce(tipo_acao, tipo_movimentacao) in ('SAIDA', 'ENTRADA', 'LIBERACAO_FORCADA')
  order by frota_id, data_hora desc, id desc
)
update public.veiculos v
set status_operacional = case
      when m.tipo_acao in ('SAIDA', 'LIBERACAO_FORCADA') then 'SAIDA_REGISTRADA'
      when v.status = 'manutencao' then 'EM_MANUTENCAO'
      when v.status = 'critico' then 'BLOQUEADA_CHECKLIST'
      else 'DISPONIVEL'
    end,
    atualizado_por = coalesce(m.usuario_portaria_id, v.atualizado_por)
from ultima_movimentacao_fisica m
where v.id = m.frota_id
  and v.status_operacional is distinct from case
    when m.tipo_acao in ('SAIDA', 'LIBERACAO_FORCADA') then 'SAIDA_REGISTRADA'
    when v.status = 'manutencao' then 'EM_MANUTENCAO'
    when v.status = 'critico' then 'BLOQUEADA_CHECKLIST'
    else 'DISPONIVEL'
  end;

-- Defesa no banco: nem uma chamada direta pode criar checklist enquanto a frota está fora.
create or replace function public.prevent_checklist_for_vehicle_outside()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status_operacional text;
begin
  select status_operacional into v_status_operacional
  from public.veiculos
  where id = new.frota_id
  for update;

  if v_status_operacional = 'SAIDA_REGISTRADA' then
    raise exception 'Frota fora da base. Registre a entrada na portaria antes de criar outro checklist.'
      using errcode = 'P0002';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_checklist_for_vehicle_outside on public.checklists_frota;
create trigger trg_prevent_checklist_for_vehicle_outside
before insert on public.checklists_frota
for each row execute function public.prevent_checklist_for_vehicle_outside();

revoke all on function public.registrar_movimentacao_idempotente(bigint, text, bigint, text, text, text, text, text, integer) from public;
grant execute on function public.registrar_movimentacao_idempotente(bigint, text, bigint, text, text, text, text, text, integer) to service_role;

commit;
