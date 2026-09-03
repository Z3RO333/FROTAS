-- Rebaixa iluminação de crítico/obrigatório para não-crítico/não-obrigatório
-- em todos os checklists já gravados. O catálogo foi alterado mas os valores
-- ficam desnormalizados na tabela de itens — este update corrige o histórico.

-- 1. Corrige os itens de iluminação gravados como crítico/obrigatório.
update public.checklist_itens
set
  critico     = false,
  obrigatorio = false
where item_codigo = 'iluminacao'
  and (critico = true or obrigatorio = true);

-- 2. Recalcula status_geral dos checklists que ficaram como CRITICO apenas por
--    causa da iluminação. Depois do passo 1, checklists sem nenhum outro item
--    critico+NAO_APTO deixam de merecer status CRITICO.
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
      and ci.critico = true   -- após o passo 1, iluminação já está false
  );
