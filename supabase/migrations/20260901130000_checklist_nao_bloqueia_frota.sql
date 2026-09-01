-- O checklist deixou de bloquear a frota: item inconforme (crítico ou não) agora
-- só sinaliza. Esta migration destrava o que já ficou preso com a regra antiga.
--
-- Cuidado com o alvo: 'BLOQUEADA_CHECKLIST' em status_operacional só era escrito
-- pelo createChecklist, então é seguro varrer. Já status = 'critico' também pode
-- ter vindo da mão de um admin — por isso só mexe nele quando vem acompanhado do
-- bloqueio de checklist, que é exatamente o par que o createChecklist gravava.
begin;

update public.veiculos
set status = 'atencao'
where status_operacional = 'BLOQUEADA_CHECKLIST'
  and status = 'critico';

update public.veiculos
set status_operacional = 'PENDENTE_ANALISE'
where status_operacional = 'BLOQUEADA_CHECKLIST';

commit;
