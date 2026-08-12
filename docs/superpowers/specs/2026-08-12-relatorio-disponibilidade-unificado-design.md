# Relatório de disponibilidade unificado (e-mail + página)

## Contexto

Hoje existem **duas implementações paralelas** do e-mail de disponibilidade de frotas, além da tabela na página web — as três divergem em layout e em colunas:

- `buildDisponibilidadeEmail()` (`lib/services/scheduled-report-senders.ts`) — HTML solto com `<style>` próprio, usado pelo disparo agendado (`email_schedules.tipo = "DISPONIBILIDADE"`, via `app/api/email/send-scheduled/route.ts`). Fonte de dados: `getDisponibilidadeResumo()` + `listFrotasEmManutencao()` de `lib/repos/disponibilidade.ts`.
- `renderRelatorioGeral()` (`lib/email-templates.ts:254`) — já usa o design system compartilhado (`shell()`/`header()`/`summaryCell()`), usado pelo envio manual (botão na página, `EnviarRelatorioDialog` → `enviarRelatorioDisponibilidadeCDAction` em `app/(app)/frotas/disponibilidades/_actions.ts` → `sendRelatorioGeral()` em `lib/email.ts`). Fonte de dados: `listFrotasForReport({ cd })`, filtrando por `local` cru — **inconsistente** com a normalização de CD (`normalizeCdNome`) usada em todo o resto da tela de disponibilidade.
- Tabela "Frotas em manutenção" da página (`app/(app)/frotas/disponibilidades/page.tsx`) — colunas Placa, Modelo, CD, Motivo, Envio, Tempo parado, Local atual, Responsável, Atalho.

O pedido é alinhar as três ao modelo de referência fornecido (prints de e-mail e de tabela web): cabeçalho com Unidade + mês de referência, KPIs (Total, Disponíveis, Em manutenção, Taxa de disponibilidade) e tabela com Frota, Placa, Unidade, Setor, Tipo OS, Descrição, Status, Início, Prev. saída.

## Decisões (confirmadas com o usuário)

- **Unificar os dois e-mails** num único template — elimina a duplicação/divergência.
- **Status = rótulo fixo "PENDENTE"** para toda linha da tabela de manutenção. Não existe (nem será criado) um campo de status real no cadastro — a tabela já lista apenas frotas *atualmente* em manutenção, que por definição estão com item em aberto. Confirmado pelo usuário: "quando ela entra em manutenção, seria esse o status".
- **Setor** vem do campo `veiculo.setor` (já populado via backfill de 2026-08-12, `supabase/migrations/20260812110000_backfill_setor_from_local.sql`), com fallback para `localizacao` — mesmo padrão `effectiveSetor` já usado em `lib/repos/relatorios.ts`.
- **Tipo OS** = campo já existente `manutencao_tipo` (ex.: "CORRETIVA", "SINISTRO"). Sem mudança de dado, só de rótulo de coluna.
- **A página web também é atualizada** para as mesmas colunas — não é só referência visual do e-mail.
- Sem ordenação client-side por coluna na tabela da página (fora de escopo; a UI atual já não tem, mantém estática).

## Arquitetura

### 1. Camada de dados — `lib/repos/disponibilidade.ts`

- `FrotaManutencaoDisponibilidade` ganha dois campos:
  - `setor: string | null` — calculado com a mesma lógica de `effectiveSetor` (setor ?? local) já usada em `lib/repos/relatorios.ts`. Extrair esse helper para um módulo compartilhado (`lib/repos/setor.ts` ou similar) para não duplicar a função entre os dois repos.
  - `status: "PENDENTE"` — literal fixo, sem nova coluna de banco.
- `listFrotasEmManutencao()` passa a preencher os dois campos novos no `.map(...)` que já existe.
- `DisponibilidadeCD`/`DisponibilidadeGeral` não mudam (Total, Disponíveis, Em manutenção, Taxa já existem).

### 2. Template de e-mail único — `lib/email-templates.ts`

Nova função `renderDisponibilidadeEmail(resumo: DisponibilidadeCD, manutencoes: FrotaManutencaoDisponibilidade[], dataRef: Date, options: ReportOptions)`, seguindo o mesmo padrão de `renderRelatorioOperacionalDiario` (checklist diário): `shell(...)` + `header(...)` + `summaryCell(...)` + tabela com cabeçalho azul/linhas zebradas.

- `header("Disponibilidade de Frotas", "Unidade: <cd_nome> · Referência: <mês/ano> · Gerado em <data/hora>", options)`.
- Linha de KPIs com `summaryCell`: Total de veículos, Disponíveis, Em manutenção, Taxa de disponibilidade (%) — 4 cards, batendo com o print de referência.
- Tabela "Veículos em manutenção": Frota, Placa, Unidade (`normalizeCdNome(localizacao)`), Setor, Tipo OS, Descrição (motivo), Status ("PENDENTE" fixo), Início (data_envio), Prev. saída (previsao_retorno). Mesmo estilo de tabela já usado em `renderRelatorioOperacionalDiario`/`renderRelatorioGeral`.
- Mantém a seção "Pontos de atenção" que já existe hoje em `buildDisponibilidadeEmail` (não está no print de referência, mas é funcionalidade existente e valiosa — não será removida silenciosamente), no mesmo estilo de tabela com badge de severidade (`pendenciaGravidadeTone` como referência de padrão).
- `renderRelatorioGeral` e o HTML inline de `buildDisponibilidadeEmail` são removidos depois que `renderDisponibilidadeEmail` estiver em uso nos dois pontos de disparo.

### 3. Disparo agendado — `app/api/email/send-scheduled/route.ts`

Troca a chamada a `buildDisponibilidadeEmail(cdNome, agora)` por buscar `getDisponibilidadeResumo(cdNome)` + `listFrotasEmManutencao(cdNome, 80)` + `getPontosAtencao(30, cdNome)` e chamar `renderDisponibilidadeEmail(...)`. `buildDisponibilidadeEmail` é removido de `scheduled-report-senders.ts`.

### 4. Disparo manual — `_actions.ts` + `lib/email.ts`

`enviarRelatorioDisponibilidadeCDAction` (`app/(app)/frotas/disponibilidades/_actions.ts`) troca `listFrotasForReport({ cd })` por `getDisponibilidadeResumo(cdNome)` + `listFrotasEmManutencao(cdNome, 80)` + `getPontosAtencao(30, cdNome)` — mesma fonte de dados do agendado, corrigindo de quebra a inconsistência de filtro por CD não-normalizado. `sendRelatorioGeral` em `lib/email.ts` é renomeado/substituído por `sendDisponibilidadeEmail`, que chama `renderDisponibilidadeEmail`.

### 5. Página web — `app/(app)/frotas/disponibilidades/page.tsx`

Tabela "Frotas em manutenção": colunas trocam de (Placa, Modelo, CD, Motivo, Envio, Tempo parado, Local atual, Responsável, Atalho) para (Frota, Placa, Unidade, Setor, Tipo OS, Descrição, Status, Início, Prev. saída). A célula "Frota" vira o link clicável para `/frotas/[id]` (substitui a coluna "Atalho" separada, junto com o ícone `ExternalLink`, mesmo padrão que hoje existe na célula "Placa").

## Testes

- `lib/repos/disponibilidade.test.ts` (novo, ou seção em arquivo existente se houver): cobre que `listFrotasEmManutencao` preenche `setor` com fallback para `localizacao` quando `setor` é nulo, e que `status` é sempre `"PENDENTE"`.
- Nenhum teste de envio real de e-mail (mesmo padrão já usado no resto do projeto — mock/skip).
- Verificação manual: reenviar o relatório de disponibilidade de um CD real (mesmo fluxo de teste manual usado no relatório de checklist) e conferir visualmente contra o print de referência antes de considerar concluído.

## Fora de escopo

- Campo de status real (Pendente/Em execução/Aguardando peça) no cadastro de manutenção — descartado explicitamente pelo usuário.
- Ordenação client-side por coluna na tabela da página.
- Mudança nos 6 cards de métricas já existentes na página (Total, Disponíveis, Manutenção, Indisponíveis, Em operação, % Disponibilidade) — só a tabela "Frotas em manutenção" muda.
- Seção "Pontos de atenção" — mantida como está, só migra de HTML inline para o template compartilhado.
