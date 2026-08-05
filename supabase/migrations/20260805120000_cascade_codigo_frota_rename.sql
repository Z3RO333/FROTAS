-- codigo_frota (Frota geral) é referenciado por FK em servicos_app e
-- servicos_km_base_app usando ON UPDATE NO ACTION (padrão). Isso bloqueia
-- qualquer rename de "Frota geral" pela tela de edição sempre que o veículo
-- já tem serviço de manutenção lançado, e o erro do banco fica escondido
-- atrás da mensagem genérica de app/(app)/frotas/_actions.ts (frotaFormError).
-- Trocando para ON UPDATE CASCADE, o rename propaga automaticamente.

alter table public.servicos_app
  drop constraint servicos_app_id_veiculo_fkey,
  add constraint servicos_app_id_veiculo_fkey
    foreign key (id_veiculo) references public.veiculos(codigo_frota)
    on update cascade on delete cascade;

alter table public.servicos_km_base_app
  drop constraint servicos_km_base_app_id_veiculo_fkey,
  add constraint servicos_km_base_app_id_veiculo_fkey
    foreign key (id_veiculo) references public.veiculos(codigo_frota)
    on update cascade on delete cascade;
