# Leitura automática de CRLV por IA

## Contexto

O KPI "CRLV vencido" (`/planejamento`) hoje calcula vencimento cruzando o calendário nacional de licenciamento (final da placa → mês) com a data cadastrada em `documents.crlv_vencimento` — mas essa data é **digitada manualmente** por quem sobe o PDF na Central de Documentos (`app/(app)/documentos`), nunca extraída do próprio documento. Isso deixa a métrica exposta a erro de digitação e a datas desatualizadas.

O app já tem um pipeline de IA equivalente para o hodômetro (`lib/ai/odometer.ts`): recebe uma foto, manda pro deployment de visão Azure OpenAI configurado (`AZURE_OPENAI_VISION_DEPLOYMENT`/`OPENAI_VISION_MODEL`, fallback `gpt-4o`), valida a resposta com Zod, retorna confiança + flag de segurança. A diferença chave: o hodômetro recebe uma **foto** (JPEG), o CRLV é enviado como **PDF** — não existe hoje nenhuma lib no projeto que renderiza PDF em imagem (só há `pdf-lib`, que edita PDF mas não rasteriza).

## Decisões (confirmadas com o usuário)

- Roda tanto nos **uploads novos** quanto num **backfill dos ~176 CRLVs já cadastrados** na Central de Documentos.
- Confiança alta → a IA **auto-preenche** `crlv_vencimento` com a data lida (prevalece sobre o que foi digitado, já que é a fonte real do documento). Confiança baixa/leitura falhou → mantém o valor manual existente (se houver) e marca o documento para revisão humana, sem sobrescrever com um valor não confiável.
- Conversão de PDF pra imagem é um passo **interno e temporário** — o PDF salvo no storage (`documents.crlv_url`) nunca muda; a imagem renderizada existe só em memória, dura o tempo da chamada à IA.
- PDF é renderizado em imagem antes de mandar pra IA (não usa o suporte a arquivo nativo da OpenAI) — reaproveita o mesmo pipeline de visão via `chat.completions` já validado em produção pelo hodômetro, sem depender de um recurso (Responses API + `input_file`) ainda não confirmado no deployment Azure atual.

## Arquitetura

### 1. Renderização de PDF → imagem

Nova função interna em `lib/ai/crlv-ocr.ts`: `renderFirstPageToPng(pdfBuffer: Buffer): Promise<Buffer>`.

- Usa `pdfjs-dist` (biblioteca oficial Mozilla, já madura para renderização headless) + `@napi-rs/canvas` como backend de canvas — `@napi-rs/canvas` distribui binários pré-compilados por plataforma (Windows/Linux/macOS), então não exige `node-gyp`/compilador na máquina de dev nem no Azure App Service, diferente do pacote `canvas` clássico.
- Renderiza só a página 1 (onde fica o campo "Válido até"/data de licenciamento em todo modelo de CRLV-e) numa escala fixa (~2x) para manter o texto legível sem gerar uma imagem gigante.
- Novas dependências: `pdfjs-dist`, `@napi-rs/canvas`.

### 2. Leitura por IA — `lib/ai/crlv-ocr.ts`

Espelha a estrutura de `lib/ai/odometer.ts`:

- `CrlvReadingSchema` (Zod): `{ data_vencimento: string | null (YYYY-MM-DD), confianca: number (0-1), leitura_segura: boolean, motivo: string | null }`.
- `readCrlvVencimento(pdfBuffer: Buffer): Promise<CrlvReading>`:
  1. `renderFirstPageToPng` → PNG buffer → data URI base64 (mesmo helper de resize/encode do odômetro, adaptado).
  2. Chama `openai.chat.completions.create` no mesmo client Azure/OpenAI já inicializado (reaproveita a inicialização eager de `odometer.ts` — extrair para um módulo compartilhado `lib/ai/vision-client.ts` usado pelos dois, evita duplicar a lógica de escolha Azure vs OpenAI direto).
  3. Prompt especializado: localizar o campo "Válido até" / "Data de licenciamento" / "Data Máxima de Licenciamento" do CRLV-e (modelo padrão nacional Renavam), devolver só a data mais recente de validade, ignorando datas de emissão/nascimento do proprietário.
  4. Resposta parseada com `CrlvReadingSchema.safeParse`; falha de parse ou API → retorna leitura "falhou" (mesmo padrão de fallback do odômetro), nunca lança exceção pro chamador.
- Sem cache (diferente do odômetro) — cada CRLV é lido uma vez só (no upload) ou uma vez no backfill, não há reenvio repetido do mesmo arquivo pelo usuário.

### 3. Banco — nova migration

`supabase/migrations/20260818140000_add_crlv_ia_tracking.sql`:

```sql
alter table public.documents
  add column if not exists crlv_vencimento_origem text check (crlv_vencimento_origem in ('MANUAL', 'IA')),
  add column if not exists crlv_vencimento_confianca numeric,
  add column if not exists crlv_revisar_manualmente boolean not null default false;
```

### 4. Upload — `app/(app)/documentos/_actions.ts`

Em `createDocumentAction` e `updateDocumentAction`, quando há `crlvFile`:

1. Lê o `ArrayBuffer` do `File` (antes ou em paralelo ao upload pro storage — a leitura não depende do arquivo já estar salvo).
2. Chama `readCrlvVencimento(buffer)`.
3. Se `leitura_segura && confianca >= 0.7` (mesmo threshold conceitual do odômetro): usa `data_vencimento` da IA, grava `crlv_vencimento_origem = 'IA'`, `crlv_vencimento_confianca`, `crlv_revisar_manualmente = false`.
4. Senão: mantém `input.crlv_vencimento` (o que veio do formulário, pode ser `null`), grava `crlv_vencimento_origem = 'MANUAL'` (ou `null` se também não há data), `crlv_revisar_manualmente = true`.
5. Falha na chamada de IA (timeout, API fora) não bloqueia o upload — cai no branch "manual" acima, mesmo comportamento de hoje.

### 5. Backfill — `scripts/backfill-crlv-ocr.ts`

Segue o padrão dos scripts existentes em `scripts/` (ex. `migrate-storage-docs.ts`):

- Busca todos os `documents` com `crlv_url` não nulo.
- Pra cada um, sequencialmente (evita rate limit da API de visão): baixa o PDF do storage, chama `readCrlvVencimento`, aplica a mesma regra de threshold do item 4, faz `update` no registro.
- Log por linha (frota, resultado, confiança) e contagem final (quantos atualizados / quantos foram pra revisão manual / quantas falhas de download ou leitura) — não aborta o lote inteiro se um PDF individual falhar.
- Roda uma vez manualmente (`npx tsx scripts/backfill-crlv-ocr.ts`), sem agendamento — é o backfill dos 176 existentes, não uma rotina recorrente.

### 6. UI — Central de Documentos

`components/documentos/documentos-workspace.tsx`: quando `crlv_revisar_manualmente` for `true`, mostra um badge "Revisar CRLV" na linha do documento (mesmo estilo dos badges de status já existentes — `Parcial`/`Pendente`), sinalizando que a IA não conseguiu ler a data com segurança e o campo precisa de conferência manual.

## Testes

- `lib/ai/crlv-ocr.test.ts` (novo, espelhando `odometer.test.ts`): mocka o client de IA, cobre `CrlvReadingSchema` rejeitando resposta malformada, threshold de confiança determinando `leitura_segura`, e o fallback quando a chamada falha.
- Sem teste de chamada real à API (mesmo padrão do odômetro — mock only).
- Verificação manual: rodar o backfill contra um subconjunto pequeno de CRLVs reais (ex. 5-10) antes de rodar nos 176, e conferir visualmente as datas extraídas contra os PDFs.

## Fora de escopo

- Extração de outros campos do CRLV (placa, Renavam, proprietário) — só a data de vencimento.
- Leitura de DUT por IA — DUT não vence, não tem KPI de vencimento associado (já tratado como "Sem DUT" por presença de arquivo).
- UI de revisão dedicada (fila/dashboard de "documentos pra revisar") — o badge na Central de Documentos já existente é suficiente por ora.
- Reenvio automático de e-mail/notificação quando um CRLV é marcado para revisão.
