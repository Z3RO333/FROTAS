# Botão de Socorro (Help Motora) — Design

## Contexto

Hoje a tela "Tipo de Acidente" (`/motorista/sinistro`) oferece dois fluxos: "Acidente com Veículo" e "Acidente com Casas", ambos gravando em `public.sinistros_frota`. Esta feature adiciona um terceiro tipo, **"Socorro / Help Motora"**, para qualquer colaborador solicitar ajuda rápida (pane, acidente, guincho, ocorrência operacional), reaproveitando a mesma tabela, storage de imagens e infraestrutura de e-mail (SendGrid) já existentes.

## 1. Modelo de dados

Nova migration `supabase/migrations/020_socorro_frota.sql`:

- Atualiza o `check` de `tipo_sinistro` em `sinistros_frota` para aceitar `'veiculo' | 'casa' | 'socorro'`.
- Novas colunas:
  - `telefone_solicitante text` — telefone de contato informado no formulário
  - `precisa_guincho boolean` — Sim/Não
  - `responsavel_atendimento text` — e-mail do admin/manutenção que assumiu o atendimento
  - `atendimento_concluido_em timestamptz` — preenchido quando status muda para `RESOLVIDO` ou `CANCELADO`
- `frota_id` passa a ser opcional para `tipo_sinistro = 'socorro'` (a aplicação não exige seleção de frota nesse fluxo; a coluna já é nullable no schema).
- `status`: para `tipo_sinistro = 'socorro'`, os valores válidos passam a ser `ABERTO`, `EM_ATENDIMENTO`, `GUINCHO_ACIONADO`, `RESOLVIDO`, `CANCELADO` (validados na aplicação, coluna continua `text`). Registro novo de socorro nasce com `status = 'ABERTO'`. Tipos `veiculo`/`casa` continuam usando o fluxo de status atual (`PENDENTE`/etc.), sem migração de dados existentes.

### Lista de Setor/Área (global)

A constante `SETORES` em `components/sinistros/driver-sinistro-form.tsx` é substituída pela nova lista, usada por **todos** os tipos de sinistro (veículo, casa, socorro):

```
Exposição
Market
E-commerce
Farma
Operação
Outros
```

Essa lista também é a base do roteamento de e-mail por área (seção 3).

## 2. Fluxo do motorista — formulário "Socorro / Help Motora"

### Tela de seleção (`/motorista/sinistro`)

Adiciona um terceiro card: **"Socorro / Help Motora"** → `/motorista/sinistro/socorro`. `TIPOS_VALIDOS` e `TipoSinistroSchema` em `_actions.ts`/`page.tsx`/`[tipo]/page.tsx` passam a incluir `"socorro"`.

### Novo componente `SocorroForm` (`components/sinistros/socorro-form.tsx`)

Formulário mais simples que o `DriverSinistroForm` (sem busca de frota, sem terceiros afetados, sem feridos/SAMU). Campos:

| Campo | Tipo | Obrigatório |
|---|---|---|
| O que aconteceu? (descrição) | textarea | sim |
| Endereço/Localização (com botão GPS, reaproveita `/api/geocode/reverse`) | input + lat/long ocultos | sim |
| Número da frota | input texto livre (ex: "4021") | não |
| Placa | input texto livre | não |
| Área do colaborador (Setor) | select (lista nova) | sim |
| Telefone para contato | input numérico | sim |
| Precisa de guincho? | radio Sim/Não | sim |
| Imagens | upload múltiplo (até 8) | não |

Nome/e-mail do solicitante vêm do usuário autenticado (`requireAppUser()`), não são campos do formulário.

### Server action

`enviarSinistroMotoristaAction` (`app/(app)/motorista/sinistro/_actions.ts`) ganha um branch para `tipo_sinistro = "socorro"`:
- Valida os campos novos (telefone, área, guincho, descrição, endereço).
- `frota_id` é omitido/opcional; `numero_frota`/`placa` vêm como texto livre do formulário (não de `getFrota`).
- Cria o registro via `createSinistro` com `status: "ABERTO"`, `telefone_solicitante`, `precisa_guincho`.
- Após criar com sucesso, chama `sendSocorroNotification` (seção 3) — falha de e-mail não bloqueia o fluxo, apenas loga.
- Redireciona para a lista do motorista com o ticket gerado, mesmo padrão `SIN-YYYYMMDD-XXXXX` existente.

## 3. Notificação por e-mail

Nova função `sendSocorroNotification()` em `lib/email.ts` + template `renderSocorroNotification()` em `lib/email-templates.ts`, seguindo o padrão visual dos templates existentes (shell/header reaproveitados).

### Destinatários

1. `FROTAS_MANUTENCAO_EMAILS` (env var já existente, lista de e-mails da manutenção de frotas)
2. `monitoramentofrotas@bemol.com.br` (fixo no código)
3. Time responsável pela área informada, via mapeamento configurável por env var — uma var por área:
   - `SOCORRO_AREA_EMAIL_EXPOSICAO`
   - `SOCORRO_AREA_EMAIL_MARKET`
   - `SOCORRO_AREA_EMAIL_ECOMMERCE`
   - `SOCORRO_AREA_EMAIL_FARMA`
   - `SOCORRO_AREA_EMAIL_OPERACAO`
   - `SOCORRO_AREA_EMAIL_OUTROS`

   Cada var aceita uma lista separada por vírgula (mesmo parser usado em `rbac.ts`). Se a env var da área não estiver configurada, esse destinatário extra é simplesmente omitido (sem erro).

### Assunto

```
[SOCORRO FROTA] Nova solicitação - Área: {área} - Guincho: {sim/não}
```

Quando `precisa_guincho = true`, o assunto recebe o prefixo `[URGENTE]`.

### Corpo

Tabela com: tipo de ocorrência, descrição, localização (endereço + link Google Maps quando houver lat/long), telefone do solicitante, área, número da frota/placa (se informados), guincho (destacado em vermelho/negrito se "sim"), nome do solicitante, ticket number, data/hora de abertura, e link para o painel admin (`/sinistros`).

WhatsApp para Daniel/Luciana fica fora desta fase (decisão registrada — pode ser endereçado depois com link `wa.me` ou integração formal).

## 4. Painel admin (`/sinistros`)

### KPIs

Novo card **"Socorros abertos"**: contagem de registros `tipo_sinistro = 'socorro'` com status em `ABERTO`, `EM_ATENDIMENTO` ou `GUINCHO_ACIONADO`. Implementado em `sinistrosDashboardKpis()` (`lib/repos/sinistros.ts`).

### Filtro por tipo

Toggle simples no topo da listagem: **Todos / Veículo / Casa / Socorro** (filtro client-side ou query param, seguindo padrão simples já usado na página).

### `SinistroCard` — campos extras para tipo `socorro`

- Telefone do solicitante
- Área (já exibido como "Setor")
- "Precisa de guincho?" — badge vermelho destacado quando "Sim"
- Badge de status com cores por valor:
  - `ABERTO` — cinza
  - `EM_ATENDIMENTO` — azul
  - `GUINCHO_ACIONADO` — laranja
  - `RESOLVIDO` — verde
  - `CANCELADO` — vermelho/cinza

### Atualização de status

Novo arquivo `app/(app)/sinistros/_actions.ts` com `atualizarStatusSocorroAction(ticketId, novoStatus)`:
- Protegido por `requireAdminUser()`.
- Valida que `novoStatus` é um dos 5 valores válidos e que o registro é `tipo_sinistro = 'socorro'`.
- Ao sair de `ABERTO` para qualquer outro status, grava `responsavel_atendimento = email do admin logado` se ainda não setado.
- Ao mudar para `RESOLVIDO` ou `CANCELADO`, grava `atendimento_concluido_em = now()`.
- `revalidatePath("/sinistros")` ao final.

Na UI, cada card de socorro tem um `<select>` de status + botão "Atualizar" que chama essa action.

## Fora de escopo (fase 1)

- Notificação via WhatsApp para Daniel/Luciana (decisão explícita — pode entrar em fase 2 como link `wa.me` ou integração formal).
- Migração de status dos tipos `veiculo`/`casa` para o novo enum.
