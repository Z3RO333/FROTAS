-- Migration: adiciona setores_incluidos em email_schedules.
-- Mesma ideia do cds_incluidos ja existente, mas no nivel de setor
-- (Expedicao Manaus, Marketplace, CD Turismo/Mercado...), usado pelo
-- RELATORIO_OPERACIONAL_DIARIO pra segmentar o relatorio: cada agenda
-- recebe so os dados das frotas cujo campo "local" bate com um dos
-- setores listados. Vazio = todas as frotas (relatorio global).

alter table public.email_schedules add column if not exists setores_incluidos text[] default '{}';
