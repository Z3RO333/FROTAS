-- Auditoria mínima garantida na mesma transação das mudanças de estado.
begin;

create or replace function public.audit_vehicle_state_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status is distinct from new.status or old.status_operacional is distinct from new.status_operacional then
    insert into public.veiculo_eventos (
      veiculo_id, tipo_evento, origem, titulo, descricao, severidade, payload, usuario_id
    ) values (
      new.id,
      'STATUS_ALTERADO',
      'trigger_banco',
      concat('Status: ', coalesce(old.status_operacional, old.status, '—'), ' → ', coalesce(new.status_operacional, new.status, '—')),
      'Evento de auditoria gerado automaticamente pelo banco.',
      case
        when new.status = 'manutencao' or new.status_operacional = 'EM_MANUTENCAO' then 'MANUTENCAO'
        when new.status_operacional = 'BLOQUEADA_CHECKLIST' then 'CRITICO'
        else 'INFO'
      end,
      jsonb_build_object(
        'status_anterior', old.status,
        'status_novo', new.status,
        'status_operacional_anterior', old.status_operacional,
        'status_operacional_novo', new.status_operacional
      ),
      new.atualizado_por
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_vehicle_state_change on public.veiculos;
create trigger trg_audit_vehicle_state_change
after update of status, status_operacional on public.veiculos
for each row execute function public.audit_vehicle_state_change();

create or replace function public.audit_pending_resolution()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status = 'RESOLVIDA' then
    insert into public.veiculo_eventos (
      veiculo_id, tipo_evento, origem, origem_id, titulo, descricao, severidade, payload, usuario_id
    ) values (
      new.frota_id, 'PENDENCIA_RESOLVIDA', 'trigger_banco', new.id,
      concat('Pendência resolvida: ', coalesce(new.item_nome, 'item')),
      'Evento de auditoria gerado automaticamente pelo banco.', 'OK',
      jsonb_build_object('gravidade', new.gravidade, 'checklist_id', new.checklist_id),
      new.responsavel_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_pending_resolution on public.pendencias_frota;
create trigger trg_audit_pending_resolution
after update of status on public.pendencias_frota
for each row execute function public.audit_pending_resolution();

create or replace function public.resolver_pendencia_atomica(
  p_pendencia_id bigint,
  p_responsavel_id text,
  p_liberar_frota boolean default false
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  pending_row public.pendencias_frota%rowtype;
  remaining_critical integer := 0;
  released boolean := false;
  vehicle_status text;
begin
  select * into pending_row
  from public.pendencias_frota
  where id = p_pendencia_id
  for update;
  if not found then raise exception 'Pendência não encontrada' using errcode = 'P0002'; end if;

  update public.pendencias_frota
  set status = 'RESOLVIDA', responsavel_id = p_responsavel_id,
      resolvido_em = coalesce(resolvido_em, now())
  where id = p_pendencia_id;

  if p_liberar_frota then
    select status into vehicle_status from public.veiculos
      where id = pending_row.frota_id for update;
    if not found then raise exception 'Frota não encontrada' using errcode = 'P0002'; end if;

    select count(*) into remaining_critical
    from public.pendencias_frota
    where frota_id = pending_row.frota_id
      and gravidade = 'CRITICA'
      and status in ('ABERTA', 'EM_TRATATIVA');

    if remaining_critical = 0 and vehicle_status is distinct from 'manutencao' then
      update public.veiculos
      set status_operacional = 'LIBERADA', atualizado_por = p_responsavel_id
      where id = pending_row.frota_id;
      released := true;
    end if;
  end if;

  return jsonb_build_object(
    'frota_id', pending_row.frota_id,
    'pendencia_id', pending_row.id,
    'bloqueios_restantes', remaining_critical,
    'liberada', released,
    'em_manutencao', vehicle_status = 'manutencao'
  );
end;
$$;

revoke all on function public.resolver_pendencia_atomica(bigint, text, boolean) from public;
grant execute on function public.resolver_pendencia_atomica(bigint, text, boolean) to service_role;

commit;
