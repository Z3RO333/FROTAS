-- O relatório de checklist diário do CD Turismo saía todo zerado (0 checklists,
-- 0 apontamentos, 0/0 frotas) mesmo em dias com checklist registrado.
--
-- Causa: a agenda 4 apontava para os setores 'CD TURISMO/ FARMA',
-- 'CD TURISMO/ MERCADO' e 'MANUTENÇÃO CD' — nomes herdados do antigo campo
-- `local`, que deixaram de existir depois da revisão do cadastro
-- (20260812110000_backfill_setor_from_local.sql e ajustes seguintes). Como
-- nenhum veículo ativo casava com esses nomes, o escopo da agenda ficava vazio
-- e o e-mail era enviado com todos os números em zero.
--
-- Setores reais equivalentes hoje: 'CD TURISMO' e 'CD TURISMO - MERCADO'.
-- Os destinatários permanecem os mesmos (os dois setores compartilham a mesma
-- lista, portanto continua sendo 1 único e-mail consolidado).
update public.email_schedules
set
  setores_incluidos = array['CD TURISMO', 'CD TURISMO - MERCADO'],
  destinatarios_por_setor = jsonb_build_object(
    'CD TURISMO', to_jsonb(destinatarios),
    'CD TURISMO - MERCADO', to_jsonb(destinatarios)
  )
where id = 4
  and tipo = 'RELATORIO_OPERACIONAL_DIARIO';
