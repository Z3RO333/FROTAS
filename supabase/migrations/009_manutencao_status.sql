-- Migration 009 — Mecânica de "Frota em manutenção" com rastreabilidade completa
-- Adiciona campos de manutenção no veículo + novos tipos de evento.

-- Campos de manutenção no veículo (estado atual)
alter table public.veiculos
  add column if not exists manutencao_motivo text,
  add column if not exists manutencao_tipo text check (manutencao_tipo is null or manutencao_tipo in ('PREVENTIVA','CORRETIVA','EMERGENCIAL','OUTRA')),
  add column if not exists manutencao_oficina text,
  add column if not exists manutencao_prev_retorno date,
  add column if not exists manutencao_observacao text,
  add column if not exists manutencao_iniciado_em timestamptz,
  add column if not exists manutencao_iniciado_por text,
  add column if not exists manutencao_bloqueia_checklist boolean default true;

create index if not exists veiculos_status_op_idx on public.veiculos (status_operacional)
  where status_operacional in ('EM_MANUTENCAO','INDISPONIVEL','BLOQUEADA_CHECKLIST');

-- Expandir tipos de evento permitidos em veiculo_eventos
alter table public.veiculo_eventos
  drop constraint if exists veiculo_eventos_tipo_evento_check;

alter table public.veiculo_eventos
  add constraint veiculo_eventos_tipo_evento_check
  check (tipo_evento in (
    'CHECKLIST_ENVIADO',
    'KM_ALTERADO',
    'KM_DIVERGENTE',
    'COMBUSTIVEL_REGISTRADO',
    'STATUS_ALTERADO',
    'MANUTENCAO_INICIADA',
    'MANUTENCAO_FINALIZADA',
    'MANUTENCAO_PRORROGADA',
    'PENDENCIA_CRIADA',
    'PENDENCIA_RESOLVIDA',
    'DOCUMENTO_VENCENDO',
    'DOCUMENTO_VENCIDO',
    'MANUTENCAO_ATRASADA',
    'PNEU_CRITICO',
    'ALERTA_CRIADO',
    'ALERTA_RESOLVIDO',
    'LIBERACAO_FORCADA'
  ));
