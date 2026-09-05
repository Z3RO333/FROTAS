-- Reduz a lista de itens obrigatórios do checklist.
-- Obrigatórios passam a ser apenas: kit_seguranca, pneus_step e documento.
-- freios, motor_oleo, radiador e limpador viram itens comuns (observação).
--
-- Obrigatoriedade não altera status_geral nem gravidade da pendência (ambos
-- dependem só de `critico`), então aqui não há recálculo a fazer — o efeito é
-- na leitura da portaria e das telas de detalhe, que usam o valor gravado na
-- linha do item.

update public.checklist_itens
set obrigatorio = false
where item_codigo in ('freios', 'motor_oleo', 'radiador', 'limpador')
  and obrigatorio = true;
