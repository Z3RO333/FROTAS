# Relatório operacional diário por e-mail

## Contexto

Já existe um relatório diário automatizado (`app/api/relatorios/daily/route.ts`), focado em análises de IA sobre checklists (criticidade, problemas detectados), disparado por GitHub Actions cron e enviado via SendGrid. O pedido aqui é um relatório operacional complementar, com foco em compliance de checklist e pendências — não em análise de IA.

## Objetivo

Enviar diariamente (7h, horário de Manaus) um e-mail consolidado com:

1. Quantidade de checklists realizados no dia anterior.
2. Quantidade de apontamentos (pendências de checklist criadas no dia anterior).
3. Frotas ativas que fizeram checklist no dia (✅).
4. Frotas ativas que não fizeram checklist no dia (🚫).
5. Lista de pendências criadas no dia, agrupadas por frota.

## Escopo e decisões

- **Destinatários**: configuráveis pela interface admin existente (`/administracao/emails`), não fixos em env var nem em código.
- **Escopo do relatório**: único e consolidado — todas as frotas juntas em um e-mail, não um e-mail por frota.
- **Critério de "não fez checklist"**: todo veículo com `ativo=true, vendido=false` conta. Não depende de escala/viagem prevista.
- **Janela de tempo**: dia anterior completo (00h–23h59, horário de Manaus), enviado às 7h do dia seguinte.
- **"Apontamentos"**: mapeado para pendências de checklist (tabela `pendencias_frota`), não abastecimentos nem sinistros.
- **Item 5 (pendências por frota)**: apenas as pendências **criadas no dia coberto pelo relatório** — não o backlog acumulado de todas as pendências abertas.

## Arquitetura

Reaproveita a infraestrutura existente de relatórios/e-mail em vez de criar um sistema novo:

- **Agendamento de destinatários**: novo tipo de agenda `RELATORIO_OPERACIONAL_DIARIO` na tabela `email_schedules` (mesmo mecanismo usado por `RELATORIO_DIARIO_IA`, `PREVENTIVAS_ATRASO`, etc.). Cadastro/edição de destinatários via `/administracao/emails`, sem deploy.
- **Endpoint**: novo `app/api/relatorios/operacional-diario/route.ts`, espelhando a estrutura de `app/api/relatorios/daily/route.ts`:
  - `POST` autenticado via `isInternalAuthorized` (header `x-internal-secret`, compara contra `FROTAS_INTERNAL_SECRET`).
  - Usa `reportCalendarDate()` e `shiftCalendarDate(hoje, -1)` para obter o dia anterior (fuso `America/Manaus`, já tratado em `lib/report-date.ts`).
  - Busca dados, monta HTML, resolve destinatários via `claimDueEmailSchedules({ tipo: "RELATORIO_OPERACIONAL_DIARIO" })`, envia, e marca `completeEmailSchedule`/`releaseEmailScheduleClaim` conforme sucesso/falha — mesmo padrão de idempotência/lock já usado no relatório de IA.
- **Disparo agendado**: novo workflow `.github/workflows/daily-report-operacional.yml`, com `cron: "0 11 * * *"` (11h UTC = 7h em Manaus, sem horário de verão) e `workflow_dispatch` para disparo manual, seguindo o padrão de `daily-report.yml` (`curl POST` + `x-internal-secret` + `concurrency` para evitar sobreposição).
- **Envio de e-mail**: novo `sendRelatorioOperacionalDiario` em `lib/email.ts`, espelhando `sendRelatorioDiarioIa` (SendGrid via `mailClient()`, log em `email_logs` via `safeLogEmail`).

## Dados e queries (novos helpers em `lib/repos/relatorios.ts`)

- `getChecklistsRealizadosNoDia(date)`: `COUNT` de `checklists_frota` no intervalo do dia (`reportDayUtcRange`).
- `getFrotasComSemChecklistNoDia(date)`: busca frotas ativas via `listFrotasForReport()` (já existe) + `DISTINCT frota_id` de `checklists_frota` no intervalo do dia; separa em dois arrays (fizeram / não fizeram) por diferença de conjuntos em memória.
- `getPendenciasCriadasNoDiaPorFrota(date)`: busca `pendencias_frota` com `criado_em` no intervalo do dia, junta com nome/placa da frota (mesmo padrão de `fetchVeiculosByIds` já usado em `listOpenPendencias`), agrupa por `frota_id`.

## Template de e-mail

Novo template HTML, seguindo o estilo visual de `buildEmailHtml` em `daily/route.ts` (mesmo CSS inline, `.kpi-grid`, tabelas):

- KPIs no topo: total de checklists, total de apontamentos, % de frotas em dia (fizeram / total ativas).
- Tabela "✅ Frotas que fizeram checklist".
- Tabela "🚫 Frotas que não fizeram checklist".
- Tabela "Pendências do dia por frota" (frota, item, gravidade).
- Link para o painel (`appUrl`), no rodapé.

## Tratamento de erros

- Nenhuma agenda ativa cadastrada para o tipo `RELATORIO_OPERACIONAL_DIARIO` → resposta 200 com aviso, sem erro (mesmo comportamento do endpoint atual).
- Falha no envio via SendGrid → libera o claim da agenda (`releaseEmailScheduleClaim`), loga erro em `email_logs`, retorna 502; o workflow do GitHub Actions falha e fica visível.
- Autenticação inválida → 401, mesmo padrão do endpoint atual.

## Testes

- Testes unitários para os 3 novos helpers de `lib/repos/relatorios.ts`: contagem de checklists no intervalo, separação corretas de frotas ativas em fez/não fez, agrupamento de pendências por frota.
- Não é necessário testar envio real de e-mail (mockar `sendRelatorioOperacionalDiario` ou usar o padrão de teste já existente para os outros `send*` de `lib/email.ts`, se houver).

## Fora de escopo

- E-mail individual por frota (explicitamente descartado — relatório é único e consolidado).
- Configuração de destinatários fora da UI admin existente.
- Pendências antigas/backlog acumulado no item 5 (só as criadas no dia coberto pelo relatório).
