-- Migration: adiciona tipo RELATORIO_OPERACIONAL_DIARIO ao email_schedules.
-- Tambem inclui RELATORIO_DIARIO_IA, que ja e aceito pela aplicacao
-- (app/(app)/administracao/emails/_actions.ts) mas nunca foi adicionado
-- ao CHECK constraint original da migration 015 — corrige o drift.

alter table public.email_schedules
  drop constraint if exists email_schedules_tipo_check;

alter table public.email_schedules
  add constraint email_schedules_tipo_check check (tipo in (
    'DISPONIBILIDADE','PREVENTIVAS_ATRASO','LAVAGEM_PENDENTE',
    'TACOGRAFO_VENCIDO','FROTAS_PARADAS','CUSTOS','ALERTAS',
    'RELATORIO_DIARIO_IA','RELATORIO_OPERACIONAL_DIARIO'
  ));
