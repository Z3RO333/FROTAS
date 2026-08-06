# Admin de e-mails: editar agenda, campos condicionais e disparo manual

## Contexto

`/administracao/emails` permite cadastrar agendas de envio automático de relatórios (`email_schedules`), mas hoje só permite criar, pausar/ativar e remover. O usuário reportou três problemas de UX:

1. Não dá pra editar uma agenda já criada — precisa excluir e recriar.
2. O formulário mostra "Dia da semana" e "Dia do mês" sempre, mesmo quando a frequência escolhida é `DIARIO` (onde nenhum dos dois se aplica).
3. Não existe forma de disparar um envio manualmente, mesmo a agenda já sendo automática — análogo a jobs do Databricks, que rodam no horário mas também podem ser disparados via "Run now".

## Escopo e decisões

- **Disparo manual = envio imediato, sem interação com o agendamento.** Ao clicar "Disparar agora", o e-mail é montado e enviado na hora usando os destinatários/configuração daquela agenda específica, mesmo que ainda não esteja no horário programado. `ultimo_envio`, `proximo_envio` e `processing_token` **não são alterados** — é uma ação paralela ao sistema de claim/complete usado pelos crons, sem afetar o próximo disparo automático.
- **Edição substitui a agenda inteira** (mesmo padrão de "criar"), não é um PATCH parcial de campos individuais.
- **Campos condicionais**: "Dia da semana" só aparece quando `frequencia = SEMANAL`; "Dia do mês" só aparece quando `frequencia = MENSAL`. Comportamento vale tanto no formulário de criação quanto no de edição.
- Este trabalho é feito como um único plano/branch (A + B juntos), não dois entregáveis separados.

## Arquitetura

### A) Editar agenda + campos condicionais

- **`lib/repos/email-schedule.ts`**: novo `getEmailSchedule(id): Promise<EmailSchedule | null>` e `updateEmailSchedule(id, patch, userEmail): Promise<void>` (substitui os campos editáveis: `nome`, `tipo`, `destinatarios`, `frequencia`, `dia_semana`, `dia_mes`, `hora_envio`, `cds_incluidos`; recalcula `proximo_envio` via `nextScheduleRun` já existente, mesmo padrão usado em `createEmailSchedule`).
- **`app/(app)/administracao/emails/_actions.ts`**: nova `updateScheduleAction(formData)`, reaproveitando o `ScheduleSchema` Zod já existente (mesmas regras de validação de criar).
- **`app/(app)/administracao/emails/ScheduleForm.tsx`** (novo componente client): formulário de criar/editar extraído da página. Recebe props opcionais (`schedule` pré-existente para modo edição, `action` do formulário). Usa `useState` só para acompanhar o `<select name="frequencia">` e condicionalmente renderizar os campos "Dia da semana"/"Dia do mês". Todo o resto do formulário permanece HTML puro, sem estado adicional.
- **`app/(app)/administracao/emails/page.tsx`**: continua server component. Lê `searchParams.editar` (id da agenda); se presente, busca a agenda via `getEmailSchedule` e renderiza `<ScheduleForm schedule={...} action={updateScheduleAction} />` com título "Editar programação"; caso contrário, renderiza `<ScheduleForm action={createScheduleAction} />` com título "Nova programação". Cada linha da lista ganha um link "Editar" (`?editar=<id>`) e um link "Cancelar" aparece no formulário quando em modo edição (`?editar` removido).

### B) Disparo manual

Pré-requisito: extrair a lógica de montagem de e-mail que hoje está embutida nos endpoints, para ser reutilizável pela nova ação de disparo manual — sem mudar nenhum comportamento existente dos crons.

- **Novo `lib/services/scheduled-report-senders.ts`**:
  - `buildDisponibilidadeEmail(cdNome, generatedAt)` — movido de `app/api/email/send-scheduled/route.ts` (idêntico, sem mudanças).
  - `buildOperationalEmail(tipo, generatedAt)` — movido de `app/api/email/send-scheduled/route.ts` (os 6 tipos: `PREVENTIVAS_ATRASO`, `LAVAGEM_PENDENTE`, `TACOGRAFO_VENCIDO`, `FROTAS_PARADAS`, `CUSTOS`, `ALERTAS`), junto com o helper privado `buildTable`.
  - `buildRelatorioDiarioIaEmail(hoje)` — extraído de `app/api/relatorios/daily/route.ts` (a busca de `getRelatorioKpis`/`listAlertasAbertos`/`getRankingFrotas`/`listAnalisesDia` + `buildEmailHtml`), retornando `{ html, kpis, criticos, alertas }`.
  - `app/api/email/send-scheduled/route.ts` e `app/api/relatorios/daily/route.ts` passam a importar essas funções do novo módulo em vez de defini-las localmente — sem mudança de comportamento.
- **`app/(app)/administracao/emails/_actions.ts`**: nova `triggerScheduleNowAction(formData)`:
  1. Autenticação/RBAC (mesmo padrão das outras actions).
  2. Busca a agenda via `getEmailSchedule(id)`.
  3. Monta e envia conforme `schedule.tipo`:
     - `DISPONIBILIDADE`: para cada CD em `schedule.cds_incluidos` (ou todos, se vazio, via `listCDsDisponibilidade()`), chama `buildDisponibilidadeEmail` e envia.
     - `RELATORIO_DIARIO_IA`: chama `buildRelatorioDiarioIaEmail(reportCalendarDate())` e envia via `sendRelatorioDiarioIa`.
     - `RELATORIO_OPERACIONAL_DIARIO`: chama `getChecklistsRealizadosNoDia`/`getFrotasComSemChecklistNoDia`/`getPendenciasCriadasNoDiaPorFrota` (dia anterior, mesmo cálculo do endpoint automático) e envia via `sendRelatorioOperacionalDiario`.
     - Demais tipos: chama `buildOperationalEmail(schedule.tipo, agora)` e envia via SendGrid direto (mesmo client usado em `send-scheduled/route.ts`).
  4. Loga cada envio em `email_logs` com `scheduleId: schedule.id`, `enviadoPor: user.email`.
  5. **Não chama** `completeEmailSchedule`/`releaseEmailScheduleClaim`/`claimDueEmailSchedules` — não interage com o sistema de claim.
  6. Redireciona com `?sucesso=`/`?erro=`, mesmo padrão das outras actions.
- **`app/(app)/administracao/emails/page.tsx`**: botão "Disparar agora" em cada linha, form action → `triggerScheduleNowAction`.

## Tratamento de erros

- Falha ao editar (validação ou banco): mesma UX de erro já usada em `createScheduleAction` (`?erro=` na URL).
- Falha ao disparar manualmente: se algum envio falhar (ex: SendGrid indisponível, CD sem dados), a action captura o erro, loga em `email_logs` com `status: "erro"`, e redireciona com mensagem de erro — sem deixar a agenda em estado inconsistente (já que essa ação nunca mexe em `ultimo_envio`/`proximo_envio`/`processing_token`).
- Para `DISPONIBILIDADE` com múltiplos CDs: se um CD falhar e outro funcionar, ambos são reportados (mesmo padrão de "enviados"/"falhas" já usado em `send-scheduled/route.ts`), mas a mensagem final ao usuário resume sucesso parcial.

## Testes

- Testes unitários para `buildTable` (função pura) no novo módulo `lib/services/scheduled-report-senders.ts` — cobre título, linhas vazias, truncagem em 100 registros.
- Verificação manual via UI real (não é possível automatizar envio real de SendGrid): criar agenda, editar, confirmar campos condicionais aparecem/somem corretamente, disparar manualmente e conferir e-mail recebido + `email_logs`.

## Fora de escopo

- PATCH parcial de campos individuais da agenda (edição é sempre substituição completa, como já é o padrão de "criar").
- Qualquer mudança no comportamento dos crons/endpoints automáticos existentes — a extração para `scheduled-report-senders.ts` é puramente uma refatoração de reuso, sem alterar lógica.
- Alterar `ultimo_envio`/`proximo_envio` como resultado de um disparo manual.
