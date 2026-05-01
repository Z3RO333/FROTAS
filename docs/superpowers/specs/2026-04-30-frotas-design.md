# Sistema de Gestão de Frotas — Design

**Data:** 2026-04-30
**Autor:** Gustavo Andrade (gustavoandrade@bemol.com.br) + Claude
**Status:** Aprovado pelo usuário, pronto para plano de implementação

## 1. Objetivo

Substituir o controle manual em `FROTAS 2026.xlsx` por uma aplicação web simples
que permita consultar, atualizar, cadastrar e excluir frotas, manter histórico
de alterações de quilometragem/status/observações, e enviar relatórios por
e-mail (geral e individual).

A planilha é a base inicial — após o import único, ela é descartada como fonte
de verdade.

## 2. Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | Next.js 16 App Router (TypeScript) | Server Actions, RSC, suporte nativo na Vercel |
| Hospedagem | Vercel (Fluid Compute) | Pedido do usuário; runtime Node.js completo |
| Banco | Databricks Unity Catalog `manutencao.cd` (Delta) | Pedido explícito do usuário; schema já existe vazio |
| Driver DB | `@databricks/sql` (Node.js) | Conector oficial; funciona em Fluid Compute |
| Auth | Auth.js v5 + Microsoft Entra ID provider | Bemol já usa Microsoft 365; SSO corporativo |
| E-mail | SendGrid (`@sendgrid/mail`) | Credenciais já provisionadas |
| UI | Tailwind CSS + shadcn/ui + Recharts | Padrão moderno; componentes acessíveis |
| Import | `xlsx` (SheetJS) em script CLI | Operação one-shot |

**Alternativas descartadas:**
- *Postgres no Vercel Marketplace + sync para Databricks*: violaria pedido de
  manter Databricks como fonte única.
- *Cache layer (Vercel Runtime Cache)*: desnecessário para ~250 registros e
  poucos usuários. Reavaliar se virar gargalo.

**Trade-off conhecido:** queries no Databricks SQL warehouse têm latência
~300–800ms (vs ~30ms num Postgres). Aceitável para o volume. Se o warehouse
auto-stop estiver curto, primeira request após idle pode levar 5–30s — UI deve
ter loading state explícito.

## 3. Variáveis de ambiente

Todas já provisionadas em `c:\frotas\.env`:

```
DATABRICKS_SERVER_HOSTNAME=adb-926216925051160.0.azuredatabricks.net
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/ead9637a3263a02e
DATABRICKS_WAREHOUSE_ID=ead9637a3263a02e
DATABRICKS_TOKEN=<pessoal>
DATABRICKS_SCHEMA=manutencao.CD
SENDGRID_API_KEY=<provisionado>
AZURE_AD_CLIENT_ID=<provisionado>
AZURE_AD_CLIENT_SECRET=<provisionado>
AZURE_AD_TENANT=<provisionado>
ALLOWED_EMAIL_DOMAIN=bemol.com.br
```

A serem adicionadas durante a implementação:
```
FROM_EMAIL=ordensmanutencao@bemol.com.br
NEXTAUTH_SECRET=<gerar>
NEXTAUTH_URL=<URL pública na Vercel>
```

## 4. Schema do banco

Três tabelas em `manutencao.cd`, todas Delta:

### 4.1 `frotas` — registro principal

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `BIGINT GENERATED ALWAYS AS IDENTITY` | PK surrogate |
| `frota_geral` | `STRING` | "1", "106", "-" — vem da planilha, NÃO é único |
| `placa` | `STRING` | pode ser `NULL` (1 caso na planilha) |
| `modelo` | `STRING` | ex: "ACCELO 815/ M. BENZ" |
| `chassi` | `STRING` | chave natural — usado para idempotência no import |
| `renavam` | `STRING` | armazenado como string (vem misturado int/str na planilha) |
| `ano_fabricacao` | `INT` | |
| `localizacao` | `STRING` | ex: "AM - MANAUS", "RO - PORTO VELHO" |
| `km_atual` | `BIGINT` | última leitura |
| `status` | `STRING` | `disponivel` \| `manutencao` \| `atencao` \| `critico` \| `vendido` |
| `observacoes` | `STRING` | texto livre |
| `vendido` | `BOOLEAN DEFAULT FALSE` | true para "VENDA*" do import |
| `ano_venda` | `INT` | extraído de "VENDA 2025/2", "VENDA 2026" |
| `ativo` | `BOOLEAN DEFAULT TRUE` | soft delete |
| `criado_em` | `TIMESTAMP` | |
| `atualizado_em` | `TIMESTAMP` | |
| `atualizado_por` | `STRING` | e-mail Bemol do último editor |

### 4.2 `frotas_historico` — histórico de alterações

| Coluna | Tipo |
|---|---|
| `id` | `BIGINT IDENTITY` |
| `frota_id` | `BIGINT` |
| `campo` | `STRING` (`km` \| `status` \| `observacoes` \| `localizacao`) |
| `valor_antigo` | `STRING` |
| `valor_novo` | `STRING` |
| `alterado_em` | `TIMESTAMP` |
| `alterado_por` | `STRING` |

Toda alteração relevante na `frotas` insere uma linha aqui.

### 4.3 `email_logs` — auditoria de envios

| Coluna | Tipo |
|---|---|
| `id` | `BIGINT IDENTITY` |
| `tipo` | `STRING` (`geral` \| `individual`) |
| `frota_id` | `BIGINT` (NULL quando geral) |
| `destinatarios` | `STRING` (e-mails separados por vírgula) |
| `assunto` | `STRING` |
| `enviado_em` | `TIMESTAMP` |
| `enviado_por` | `STRING` |
| `status` | `STRING` (`enviado` \| `erro`) |
| `erro_msg` | `STRING` |

## 5. Telas

| Rota | Função | Auth |
|---|---|---|
| `/login` | Botão "Entrar com Microsoft" → fluxo Entra ID | público |
| `/` | **Dashboard**: KPIs (total ativos, em atenção, em crítico, idade média, km médio) + donut chart por status + filtros globais (localização, modelo) | logado |
| `/frotas` | **Lista**: tabela com busca (placa/chassi/modelo) + filtros (modelo, localização, ano, status) + paginação. Botões "Nova frota" e "Enviar relatório geral" | logado |
| `/frotas/[id]` | **Detalhe**: blocos com dados + gráfico de evolução do km + timeline de histórico + botões editar/excluir/enviar e-mail individual | logado |
| `/frotas/novo` | **Cadastro**: form com validação | logado |
| `/frotas/vendidos` | **Vendidos**: lista de `vendido=true`, somente leitura | logado |

## 6. Regras de negócio

### 6.1 Idade
Calculada em runtime: `anoAtual - ano_fabricacao`. Não é coluna no banco.

### 6.2 Status automático (quando não setado manualmente)
- `idade > 10` OU `km_atual > 600_000` → `critico`
- `idade > 7` OU `km_atual > 400_000` → `atencao`
- senão → `disponivel`

`manutencao` é override manual (selecionado pelo usuário). `vendido` vem do
import ou marcação manual.

Os thresholds (7, 10, 400k, 600k) ficam em constantes em `lib/rules.ts` para
poderem ser ajustados sem migração.

### 6.3 Import de "VENDA"
Linha cuja `LOCALIZAÇÃO` começa com "VENDA" (case-insensitive):
- `vendido = true`
- `ativo = true`
- `ano_venda` extraído via regex (ex: "VENDA 2025/2" → 2025; "VENDA 2026" → 2026; "VENDA" → NULL)
- `localizacao` mantém o texto original (auditoria)

### 6.4 Histórico
Toda alteração de `km_atual`, `status`, `observacoes` ou `localizacao` insere
uma linha em `frotas_historico`. Outros campos não geram histórico.

### 6.5 Soft delete
"Excluir" marca `ativo = false`. Listagem padrão filtra `ativo = true AND vendido = false`.
Vendidos vão para `/frotas/vendidos`. Não há tela para `ativo = false` por enquanto.

### 6.6 Auth gate
- Middleware Next.js bloqueia tudo exceto `/login`, `/api/auth/*`, e arquivos estáticos quando não autenticado.
- Callback `signIn` do Auth.js rejeita e-mails que não terminem em `@bemol.com.br` (`ALLOWED_EMAIL_DOMAIN`).

## 7. Fluxo de import inicial

Script CLI `npm run import`:

1. Lê `C:\Users\21664\Downloads\FROTAS 2026.xlsx` via SheetJS.
2. Para cada linha (skip header):
   - Normaliza valores (string strip, RENAVAM como string).
   - Detecta VENDA → seta flags + extrai `ano_venda`.
   - Calcula `status` inicial via regras (6.2).
3. Conecta no Databricks, faz `MERGE INTO manutencao.cd.frotas USING source ON chassi = chassi WHEN MATCHED UPDATE … WHEN NOT MATCHED INSERT …`.
4. Imprime relatório (linhas inseridas / atualizadas / ignoradas por chassi vazio).

Idempotente: rodar duas vezes não duplica.

## 8. Fluxo de e-mail (SendGrid)

Server Action `enviarRelatorio({ tipo, destinatarios, frotaId? })`:

1. Valida sessão (usuário logado).
2. Busca dados:
   - `tipo='geral'`: lista todas frotas ativas (filtros opcionais).
   - `tipo='individual'`: busca uma frota + último mês de histórico.
3. Renderiza HTML com template (header azul Bemol, tabela em estilo da 2ª screenshot).
4. Chama `sgMail.send({ from: FROM_EMAIL, to: destinatarios, subject, html })`.
5. Insere registro em `email_logs` (sucesso ou erro).
6. Retorna `{ ok: true }` ou `{ ok: false, message }` para o cliente.

## 9. Estrutura de pastas

```
c:\frotas\
  app/
    (auth)/login/page.tsx
    (app)/
      layout.tsx                # nav + sidebar
      page.tsx                  # dashboard
      frotas/
        page.tsx                # lista
        [id]/page.tsx           # detalhe
        novo/page.tsx           # cadastro
        vendidos/page.tsx       # aba vendidos
    api/auth/[...nextauth]/route.ts
  lib/
    db.ts                       # Databricks connection helper
    repos/
      frotas.ts                 # CRUD + queries
      historico.ts
      email-logs.ts
    auth.ts                     # NextAuth config
    email.ts                    # SendGrid wrapper + templates
    rules.ts                    # status calc, parsing VENDA, thresholds
  components/
    ui/                         # shadcn primitives
    dashboard/                  # KPIs, donut chart
    frotas/                     # FrotasTable, FrotaCard, FrotaForm
    relatorios/                 # EnviarRelatorioDialog
  scripts/
    create-schema.ts            # `npm run db:init` → cria as 3 tabelas
    import-xlsx.ts              # `npm run import` → popula do .xlsx
  middleware.ts                 # auth gate
  package.json
  next.config.ts
  vercel.ts                     # config Vercel
  tailwind.config.ts
  tsconfig.json
  .env                          # já provisionado
```

## 10. Componentes principais

- `lib/db.ts`: cria/cacheia uma sessão Databricks por instância de função (Fluid Compute reusa). Expõe `query<T>(sql, params)` retornando array tipado.
- `lib/repos/frotas.ts`: `listFrotas(filters)`, `getFrota(id)`, `createFrota(data)`, `updateFrota(id, data, userEmail)` (faz INSERT em historico para campos rastreados), `softDeleteFrota(id, userEmail)`, `kpis()`.
- `lib/email.ts`: `sendRelatorioGeral`, `sendRelatorioIndividual`, ambos retornando `{ ok, error? }` e gravando em `email_logs`.
- `lib/rules.ts`: `calcularStatus(idade, km)`, `parseVenda(localizacao)`, `THRESHOLDS`.
- Server Actions em `app/(app)/frotas/_actions.ts` para mutações (cadastrar/editar/excluir/enviar e-mail).

## 11. Segurança

- Todas as Server Actions verificam sessão antes de executar (`auth()` do Auth.js).
- Acesso ao Databricks token só do server (env var; nunca exposto ao cliente).
- Validação de input com `zod` em todos os Server Actions.
- E-mails de destinatários validados apenas como formato (regex). Sem restrição de domínio — relatórios podem precisar ir para fornecedores externos de manutenção.
- `ALLOWED_EMAIL_DOMAIN` no callback `signIn` impede usuários externos de logar.

## 12. Out of scope (ficam para depois)

- Visualização de frotas com `ativo=false` (excluídas).
- Edição em massa.
- Upload de imagens das frotas.
- Notificações automáticas (cron mensal de alerta).
- Histórico de motoristas / checklist de criticidade (apenas referência visual; o usuário disse que não precisa).
- Integração com sistemas externos (manutenção, financeiro).

## 13. Critérios de aceite

- [ ] Login Bemol funciona e bloqueia e-mails externos
- [ ] Schema `manutencao.cd` criado com as 3 tabelas
- [ ] Import da planilha popula todas as frotas válidas encontradas na base, sem duplicar registros (idempotente)
- [ ] Dashboard mostra KPIs e donut chart
- [ ] Lista permite buscar/filtrar/paginar e abrir detalhe
- [ ] Edição de frota grava histórico nas mudanças de km/status/observacoes/localizacao
- [ ] Enviar relatório geral por e-mail (com filtros) funciona via SendGrid
- [ ] Enviar relatório individual de uma frota funciona
- [ ] Aba `/frotas/vendidos` mostra os vendidos
- [ ] Soft delete funciona (frota some da lista padrão)
- [ ] Deploy na Vercel com todas as env vars
