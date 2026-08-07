-- Migration: adiciona coluna "setor" em veiculos.
-- CD (campo "local") e setor sao eixos diferentes: o CD e a distribuidora fisica
-- (CD Manaus, CD Tarumã, CD Boa Vista...) e o setor e o departamento operacional
-- dentro desse CD (Expedicao, Marketplace, Exposicao de Lojas, Entrega Interior...).
-- Corrige um erro anterior em que o campo "local" (CD) foi sobrescrito com valores
-- de setor da planilha "Frotas CD.xlsx" — os dados foram restaurados/realocados
-- diretamente no banco, sem migration versionada (correcao pontual de dados).

alter table public.veiculos add column if not exists setor text;
comment on column public.veiculos.setor is 'Departamento operacional dentro do CD (ex: Expedicao, Marketplace, Entrega Interior) - distinto do CD/local fisico do veiculo.';
