# Plataforma Unificada de Gestão de Frotas — Design

**Data:** 2026-05-13
**Autor:** Gustavo Andrade + Claude
**Status:** Aprovado — pronto para plano de implementação

---

## 1. Objetivo

Unificar três projetos separados em uma única plataforma Next.js:

| Projeto | Vira |
|---|---|
| `Z3RO333/FROTAS` (base) | Plataforma principal (já existe em `c:\frotas`) |
| `Z3RO333/gestao-pneus` | Módulos `/pneus`, `/manutencao`, `/equipamentos`, `/operacao`, `/oficinas` |
| `Z3RO333/consulta-documentos-frota` | Módulo `/documentos` |

---

## 2. Arquitetura de Dados

### 2.1 Dois bancos com fronteira clara

**Databricks (`manutencao.cd`) — dados que já existem, não migram:**
- `frotas`, `frotas_historico`, `email_logs`
- `checklists_frota`, `checklist_itens`, `pendencias_frota`
- `movimentacoes_frota`, `abastecimentos`, `historico_km`
- `unidades_operacionais`

**Supabase novo (`nwoqastjgkgsifmxdqwp`) — todas as tabelas migradas:**

_Do gestao-pneus:_
- `veiculos` — catálogo de veículos com `codigo_frota`, `placa`, `modelo`, `qtd_pneus`
- `servicos_app` — registro-mãe de todos os serviços (pneus, alinhamento, lavagem, etc.)
- `trocas_pneus_app` — detalhes de troca de pneus por posição
- `alinhamentos_app` — alinhamentos
- `lavagens_app` — lavagens
- `servicos_km_base_app` — km base por veículo/tipo de serviço
- `numero_fogo` — número de fogo sequencial
- `equipamentos_app` — empilhadeiras, selecionadoras, paleteiras
- `equipamentos_preventivas_app` — preventivas 300h/1500h
- `equipamentos_componentes_app` — carregadores e baterias
- `operacao_motoristas_app` — motoristas de operação
- `operacao_permissoes_app` — permissões de operação
- `operacao_demandas_app` — demandas de movimentação
- `operacao_demandas_adm_app` — acompanhamentos de demandas
- `operacao_oficinas_app` — oficinas cadastradas
- `operacao_oficina_registros_app` — registros de serviço em oficinas
- `operacao_motoristas_localizacao_app` — localização atual de motoristas
- `operacao_motoristas_localizacao_historico_app` — histórico de localização

_Do consulta-documentos-frota:_
- `documents` — DUT + CRLV por frota (`frota`, `placa`, `modelo`, `dut_url`, `crlv_url`)

### 2.2 Vinculação cross-banco

`veiculos.codigo_frota` (Supabase) ↔ `frotas.frota_geral` (Databricks).
Sem FK real entre bancos — join feito na camada de serviço quando necessário (ex: página de detalhe da frota mostra serviços de manutenção).

### 2.3 Storage Supabase

Bucket `documents` (privado) — documentos DUT/CRLV já usados no consulta-documentos-frota. Manter mesma estrutura de paths: `{placa}/{uuid}/{filename}`.

---

## 3. Autenticação

**Microsoft Entra ID via Auth.js v5** — já implementado no FROTAS, não muda.

O Supabase Auth dos projetos de origem (email/senha) é **descartado**. O Supabase é usado apenas como banco de dados — acessado exclusivamente via **service role key no servidor**.

- `profiles` (consulta-documentos-frota) → não migra
- `operacao_permissoes_app` → migra, usa `email` como chave de identidade
- RLS: habilitado em todas as tabelas com policy `auth.role() = 'service_role'` — bloqueia acesso acidental via anon key, controle real fica no RBAC do Next.js

---

## 4. RBAC

Perfis já existentes em `lib/rbac.ts` (FROTAS):

| Perfil | Acesso novo |
|---|---|
| `DEV` / `ADMIN` | Tudo |
| `GESTOR` | Todos os módulos menos `/admin` |
| `MANUTENCAO` | `/pneus`, `/manutencao`, `/equipamentos`, `/oficinas` |
| `PORTARIA` | `/operacao` (já tem acesso a `/portaria`) |
| `MOTORISTA` | `/checklist`, `/meus-checklists` — sem acesso aos novos módulos |

---

## 5. Estrutura de Rotas

```
/                        Dashboard geral (Databricks) ← já existe
/frotas                  Gestão de frotas             ← já existe
/frotas/[id]             Detalhe da frota             ← já existe
/checklist               Checklist motorista          ← já existe
/portaria                Portaria                     ← já existe
/pendencias              Pendências                   ← já existe
/unidades                Unidades operacionais        ← já existe

── NOVOS ──────────────────────────────────────────────────────
/pneus                   Troca de pneus + visual de posições
/manutencao              Motor, suspensão, embreagem, baterias,
                         AC, lavagem, tacógrafo, portas roll-up,
                         radar de serviços, número de fogo
/equipamentos            Empilhadeiras + preventivas + componentes
/operacao                Demandas + motoristas + localização/mapa
/oficinas                Cadastro + mapa de oficinas
/documentos              DUT + CRLV por frota
```

---

## 6. Infraestrutura de integração Supabase (nova)

Arquivo `lib/supabase-manutencao.ts` no FROTAS:

```ts
import { createClient } from "@supabase/supabase-js";

export const supabaseManutencao = createClient(
  process.env.SUPABASE_MANUTENCAO_URL!,
  process.env.SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
```

Env vars a adicionar no `.env` do FROTAS:
```
SUPABASE_MANUTENCAO_URL=https://nwoqastjgkgsifmxdqwp.supabase.co
SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY=<service role key do novo projeto>
NEXT_PUBLIC_SUPABASE_MANUTENCAO_URL=https://nwoqastjgkgsifmxdqwp.supabase.co
NEXT_PUBLIC_SUPABASE_MANUTENCAO_ANON_KEY=<anon key do novo projeto>
```

---

## 7. Estratégia de Migração de Dados

### Fase 0 — Schema no novo projeto
1. Aplicar migration SQL consolidada no `nwoqastjgkgsifmxdqwp`
2. Criar bucket `documents` no Storage

### Fase 1 — Migração de dados
Scripts em `scripts/migrate-supabase.ts`:
- Ler dados do projeto gestao-pneus (`olqngohdioglrxqalffh`) via REST API (service role key fornecida)
- Inserir no novo projeto (`nwoqastjgkgsifmxdqwp`)
- Ler dados do projeto consulta-documentos-frota (`llullmnpyafsdarpwezs`) via REST API
- Inserir `documents` no novo projeto
- Migrar arquivos do Storage (DUT/CRLV) do bucket antigo para o novo

### Fase 2 — Integração de código
Por módulo, em ordem:
1. `/documentos` — mais simples, valida arquitetura
2. `/pneus` — maior valor operacional
3. `/manutencao` — radar + serviços por tipo
4. `/equipamentos` — empilhadeiras/preventivas
5. `/operacao` — demandas + localização
6. `/oficinas` — mapa
7. Sidebar: adicionar novos itens com guarda RBAC

---

## 8. Convenções de código

- Todos os repos de origem são JavaScript — adaptar para TypeScript no FROTAS
- Componentes React: client components apenas quando necessário (formulários, estado local, mapa)
- Queries Supabase: sempre via `lib/repos/manutencao/` (padrão repo já existente no FROTAS)
- Zod em todos os Server Actions
- Sem Supabase client no browser — apenas server-side

---

## 9. Out of scope nesta fase

- Migração do Supabase Auth dos projetos de origem para Microsoft (usuários existentes não migram — plataforma é nova)
- Alertas automáticos por e-mail (módulo `/alertas` — fase posterior)
- Relatórios Databricks avançados (módulo `/relatorios` — fase posterior)
- App mobile nativo
