-- A tela "Enviar PDFs" (app/(app)/documentos/_actions.ts) sempre fazia INSERT,
-- nunca verificava se a frota/placa já tinha documento. Isso gerou 249 linhas
-- duplicadas em produção (mesma frota com CRLV numa linha e DUT em outra),
-- fazendo a Central de Documentos mostrar pendências que já tinham sido
-- resolvidas em outra linha. Dados já deduplicados via
-- scripts/merge-duplicate-documents.ts antes desta migration.
--
-- createDocumentAction agora busca por frota+placa antes de inserir e
-- atualiza o registro existente em vez de duplicar; esta constraint é a
-- proteção de banco contra corrida (duas gravações simultâneas).

alter table public.documents
  add constraint documents_frota_placa_key unique (frota, placa);
