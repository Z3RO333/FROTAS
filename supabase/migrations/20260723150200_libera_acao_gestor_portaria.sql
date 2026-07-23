-- Liberação excepcional existe, mas só é chamada pela aplicação após validar perfil gestor.
begin;

alter table public.movimentacoes_frota
  drop constraint if exists movimentacoes_frota_tipo_acao_check;

alter table public.movimentacoes_frota
  add constraint movimentacoes_frota_tipo_acao_check
  check (tipo_acao in (
    'SAIDA',
    'ENTRADA',
    'BLOQUEIO',
    'SOLICITACAO_CORRECAO',
    'OBSERVACAO',
    'LIBERACAO_FORCADA'
  ));

commit;
