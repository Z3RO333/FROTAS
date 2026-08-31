# Quadro de atividades de manutenção (fim do WhatsApp + planilha)

## Contexto

Hoje o time de manutenção coordena o deslocamento de frotas entre oficinas/CDs
(ex: "Frota 300 Levar para o BONFIM", "Frota 307 Liberada no GALPÃO DA TS",
"Fazer Teste de Percurso") por mensagem de WhatsApp, e depois alguém copia
manualmente cada linha pra uma planilha (`Frotas | Atividade | Status |
Motorista`) pra ter algum controle. É repetitivo, sem histórico estruturado, e
sem noção de quanto tempo cada deslocamento levou.

Existe hoje um grupo de motoristas específico da manutenção — que fazem esse
tipo de deslocamento avulso entre unidades, sem estar vinculados a uma frota
fixa como o motorista comum do app (`/motorista`, que gira em torno de "sua
frota atual" pra checklist diário).

## Decisões (confirmadas com o usuário)

- Cada linha da planilha é uma **atividade atômica** (não um par
  origem/destino): "Liberada em X" e "Levar para Y" são registros separados,
  cada um com seu próprio status e motorista — confirmado pela planilha real
  fornecida.
- Quem cria atividades: qualquer perfil com acesso à manutenção (MANUTENCAO,
  GESTOR, ADMIN, DEV) — não é exclusivo de um cargo.
- Motorista interno **loga no app** normalmente (Entra ID, como os outros
  perfis) — não é um link avulso sem conta.
- Ele usa a **mesma tela `/motorista`** já existente (mesmo layout, mesma
  bottom bar, mesmas abas de Checklist/Sinistro que o motorista comum já tem)
  — só ganha uma aba nova, "Atividades". Não é um módulo/rota separada.
- Só o tipo `LEVAR_PARA` (deslocamento) exige foto de chegada + tem tempo de
  viagem calculado. Os demais tipos (`LIBERADA`, `TESTE_PERCURSO`, `OUTRO`)
  ficam com foto opcional, só o flag de concluído.
- `LEVAR_PARA` também exige que o motorista já tenha feito o **checklist do
  dia daquela frota** antes de poder concluir a atividade — mesma trava que
  já existe hoje pro motorista comum antes de usar uma frota.
- Sem notificação push/WhatsApp no v1 — o motorista interno confere a lista de
  pendências na aba dele, do mesmo jeito que o motorista comum confere o
  checklist pendente hoje.

## Arquitetura

### 1. Perfil novo — `MOTORISTA_INTERNO`

- `lib/perfis.ts`: adiciona `"MOTORISTA_INTERNO"` a `PERFIS_USUARIO` e um
  label em `PERFIL_LABELS` ("Motorista interno").
- `lib/rbac.ts`:
  - Nova env var `FROTAS_MOTORISTA_INTERNO_EMAILS` (mesmo padrão das outras
    listas), checada em `resolvePerfilFromEnv` antes do fallback de
    `DRIVER_EMAILS`.
  - `canAccessMotorista` passa a aceitar `MOTORISTA_INTERNO` — ele usa
    `requireMotoristaUser` normalmente, sem rota nova.
- Tela de administração de usuários (onde já existe o seletor de perfil) só
  precisa listar o novo perfil — já é dirigida por `PERFIS_USUARIO`, sem
  mudança de código adicional esperada além da adição ao enum.

### 2. Dados — nova migration

`supabase/migrations/20260901120000_atividades_manutencao.sql`:

```sql
create table if not exists public.atividades_manutencao (
  id bigserial primary key,
  frota_id bigint not null references public.veiculos(id) on delete cascade,
  frota_codigo text not null,
  tipo text not null check (tipo in ('LEVAR_PARA', 'LIBERADA', 'TESTE_PERCURSO', 'OUTRO')),
  local text not null,
  observacao text,
  motorista_id text not null references public.usuarios(id),
  motorista_nome text not null,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'CONCLUIDA')),
  foto_conclusao_path text,
  criado_por_email text not null,
  criado_por_nome text not null,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create index if not exists atividades_manutencao_motorista_status_idx
  on public.atividades_manutencao (motorista_id, status);
create index if not exists atividades_manutencao_frota_idx
  on public.atividades_manutencao (frota_id);

alter table public.atividades_manutencao enable row level security;
create policy atividades_manutencao_service_role on public.atividades_manutencao
  for all using (public.is_service_role()) with check (public.is_service_role());
```

Tempo de viagem (`LEVAR_PARA`) não é uma coluna — é calculado na leitura como
`concluido_em - criado_em`, igual ao padrão já usado pra outras métricas de
duração no projeto (ex: `manutencao_iniciado_em` em `veiculos`).

Bucket de storage novo `atividades-media` (privado), reaproveitando
`sanitizeImageForStorage` (`lib/upload-validation.ts`) e o padrão de
`lib/repos/sinistro-images.ts` (upload, signed URL, remove).

### 3. Repo — `lib/repos/atividades-manutencao.ts`

- `listAtividades(filters: { status?, motoristaId?, frotaId?, de?, ate? })` —
  usado pela tela de manutenção (tabela com filtros).
- `listAtividadesPendentesPorMotorista(motoristaId: string)` e
  `listAtividadesRecentesPorMotorista(motoristaId: string, limit)` — usados
  pela aba do motorista.
- `criarAtividade(input)` — grava a linha `PENDENTE`.
- `concluirAtividade(id, { fotoPath?, usuarioEmail })` — seta `status =
  'CONCLUIDA'`, `concluido_em = now()`, `foto_conclusao_path` se houver.
  Validações de negócio (foto obrigatória, checklist do dia) ficam na camada
  de action/página, não no repo — o repo só persiste.

### 4. Módulo de criação — `/manutencao/atividades`

Mesmo padrão do módulo de peças (`/manutencao/pecas`):

- `page.tsx`: tabela igual à planilha (Frota | Tipo | Local | Status |
  Motorista | Tempo, quando concluída), com filtros por status/motorista/
  data. Botão "Nova atividade" abre formulário: busca de frota (reaproveita
  `VehicleSearchSelect` já usado no formulário de peças), tipo (select),
  local (texto), motorista (select carregado via
  `listUsuarios({ perfil: "MOTORISTA_INTERNO", ativo: "ativos" })`),
  observação opcional.
- `_actions.ts`: `criarAtividadeAction` (`requireManutencaoUser`).
- Guarda de acesso: `requireManutencaoUser` — mesma regra de hoje
  (MANUTENCAO/GESTOR/ADMIN/DEV), sem permissão nova.

### 5. Módulo de conclusão — aba "Atividades" em `/motorista`

- `components/motorista/bottom-action-bar.tsx`: item novo `{ href:
  "/motorista/atividades", label: "Atividades", icon: ... }`, renderizado
  condicionalmente — só quando `user.perfil === "MOTORISTA_INTERNO"` (a
  lista de itens passa a ser montada em função do perfil recebido via prop,
  em vez de uma constante fixa).
- `app/(app)/motorista/atividades/page.tsx`: lista de pendentes + histórico
  recente do motorista logado (`requireMotoristaUser`, filtra por
  `motorista_id = user.email`).
- `app/(app)/motorista/atividades/_actions.ts`: `concluirAtividadeAction`
  (form action, aceita foto opcional/obrigatória conforme `tipo`):
  1. Se `tipo === 'LEVAR_PARA'`: verifica se existe checklist do dia
     (`data_checklist` de hoje) pra `frota_id` feito por esse motorista
     (reaproveita a mesma checagem usada em `lib/frota-derived.ts` /
     `getFrota`, adaptada pra "existe checklist hoje" em vez de cooldown). Se
     não existir, retorna erro pedindo pra fazer o checklist primeiro, com
     link pra `/motorista/checklist?frota=<id>` (mesmo padrão de erro exibido
     hoje nos outros formulários do motorista).
  2. Se `tipo === 'LEVAR_PARA'` e não veio foto: erro "Anexe uma foto de
     chegada para concluir esta atividade."
  3. Caso contrário, upload da foto (se houver) via
     `uploadAtividadeImage`, então `concluirAtividade`.
- `app/(app)/motorista/page.tsx` (home): quando `user.perfil ===
  "MOTORISTA_INTERNO"`, troca o card "Sua frota atual" por um card "Atividades
  pendentes" (contagem + link pra `/motorista/atividades`) — ele não tem uma
  frota fixa, então esse card não se aplica. O bloco de "Histórico rápido"
  (checklists) abaixo continua igual, já que ele também pode fazer checklist
  de qualquer frota que estiver levando.

## Regras de negócio (resumo)

| Tipo            | Foto ao concluir | Checklist do dia exigido | Tempo calculado |
|------------------|-------------------|----------------------------|--------------------|
| `LEVAR_PARA`     | Obrigatória        | Sim                         | Sim (criado→concluído) |
| `LIBERADA`       | Opcional           | Não                         | Não |
| `TESTE_PERCURSO` | Opcional           | Não                         | Não |
| `OUTRO`          | Opcional           | Não                         | Não |

## Testes

- Unit: cálculo de tempo de viagem (formatação de duração) e as regras de
  bloqueio de conclusão (foto obrigatória / checklist obrigatório) isoladas
  em funções puras testáveis, no estilo de `lib/checklists/rules.ts` +
  `lib/checklists/rules.test.ts`.
- Manual: fluxo completo — manutenção cria atividade `LEVAR_PARA` → aparece
  pendente pro motorista interno → tentativa de concluir sem checklist é
  bloqueada → faz checklist → concluir libera, pede foto → atividade some da
  lista de pendentes e aparece no histórico com o tempo calculado.

## Fora de escopo (v1)

- Notificação push/e-mail/WhatsApp quando uma atividade é criada ou
  concluída.
- Edição/cancelamento de atividade já criada (se for preciso corrigir, cria
  outra — mesma lógica informal de hoje).
- Métricas/relatórios agregados de tempo médio por motorista/rota (a base de
  dados fica pronta pra isso depois, mas não faz parte deste escopo).
