-- A data de vencimento do CRLV (documents.crlv_vencimento) era só digitada
-- manualmente por quem fazia o upload — sem nenhuma verificação contra o
-- documento real. Agora a IA lê o PDF e preenche essa data quando consegue
-- ler com confiança; essas colunas registram a origem/confiança da leitura e
-- sinalizam quando precisa de conferência humana.

alter table public.documents
  add column if not exists crlv_vencimento_origem text check (crlv_vencimento_origem in ('MANUAL', 'IA')),
  add column if not exists crlv_vencimento_confianca numeric,
  add column if not exists crlv_revisar_manualmente boolean not null default false;
