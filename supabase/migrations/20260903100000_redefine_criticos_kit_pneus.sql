-- Redefine quais itens são críticos: apenas kit_seguranca e pneus_step.
-- freios deixa de ser crítico (vira obrigatório simples).
-- kit_seguranca passa a ser crítico.
-- Corrige também os registros já gravados em checklist_itens.

-- 1. freios: critico true → false nos registros históricos
update public.checklist_itens
set critico = false
where item_codigo = 'freios' and critico = true;

-- 2. kit_seguranca: critico false → true nos registros históricos
update public.checklist_itens
set critico = true
where item_codigo = 'kit_seguranca' and critico = false;

-- 3. Recalcula status_geral dos checklists que eram CRITICO apenas por freios.
--    Após o passo 1, checklists sem nenhum outro item critico+NAO_APTO são rebaixados.
update public.checklists_frota cf
set status_geral =
  case
    when exists (
      select 1 from public.checklist_itens ci
      where ci.checklist_id = cf.id and ci.status = 'NAO_APTO'
    ) then 'NAO_APTO'
    else 'COM_OBSERVACAO'
  end
where cf.status_geral = 'CRITICO'
  and not exists (
    select 1 from public.checklist_itens ci
    where ci.checklist_id = cf.id
      and ci.status = 'NAO_APTO'
      and ci.critico = true  -- após passo 1 e migration anterior, só kit_seguranca e pneus_step restam
  );
