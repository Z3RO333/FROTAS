-- Setor é campo novo (20260811120000_add_setor_veiculos.sql) e ficou vazio na
-- quase totalidade das frotas, quebrando relatórios/e-mails agrupados por
-- setor. Até o cadastro ser revisado frota a frota, local (CD/unidade) é o
-- melhor valor disponível para preencher o setor retroativamente.
update public.veiculos
set setor = local
where setor is null and local is not null;
