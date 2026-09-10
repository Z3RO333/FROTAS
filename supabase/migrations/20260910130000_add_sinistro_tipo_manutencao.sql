-- Adiciona "SINISTRO" como tipo de manutenção válido (dropdown "Enviar para
-- manutenção" em /frotas): veículo em manutenção por causa de um acidente,
-- separado de "Corretiva" (que é desgaste/defeito, não sinistro).

alter table public.veiculos
  drop constraint if exists veiculos_manutencao_tipo_check;

alter table public.veiculos
  add constraint veiculos_manutencao_tipo_check
  check (manutencao_tipo is null or manutencao_tipo in ('PREVENTIVA','CORRETIVA','EMERGENCIAL','OUTRA','SINISTRO'));
