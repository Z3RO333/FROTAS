-- A Central de Documentos (/documentos) só controlava upload de PDF (dut_url/crlv_url),
-- sem nenhuma data de vencimento. A tela de Vencimentos (/planejamento/documentos) lia de
-- fact_documentos_frota, uma tabela alimentada por importação manual de planilha Excel,
-- totalmente desconectada dos uploads feitos aqui — atualizar um documento na Central
-- nunca refletia na tela de Vencimentos. Adiciona as datas de vencimento na própria
-- tabela documents para a tela de Vencimentos passar a ler dessa fonte única.

alter table public.documents
  add column if not exists dut_vencimento date,
  add column if not exists crlv_vencimento date;
