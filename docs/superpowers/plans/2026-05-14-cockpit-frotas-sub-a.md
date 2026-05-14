# Cockpit de Frotas — Sub-projeto A: Schema + ETL Simples

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o schema de staging + fact tables no Supabase e importar as 8 abas simples da planilha PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx, tornando os dados disponíveis para o cockpit.

**Architecture:** Migration 006 cria staging + tabelas de fato. Scripts TypeScript em `scripts/import-planejamento/` carregam dados via XLSX → staging → fact tables usando o cliente Supabase existente. Cada script é idempotente via `batch_id` + `hash_linha`.

**Tech Stack:** Next.js App Router, Supabase PostgreSQL, TypeScript, `xlsx` (já instalado), `tsx`, `dotenv/config`, `crypto` (nativo Node).

---

## Mapa de Arquivos

| Arquivo | Op | Responsabilidade |
|---|---|---|
| `supabase/migrations/006_planejamento_staging.sql` | Criar | Todas as tabelas de staging e fato |
| `scripts/import-planejamento/utils.ts` | Criar | Helpers: serial→date, normPlaca, normStatus, hashLinha |
| `scripts/import-planejamento/00-staging.ts` | Criar | Carrega todas as abas brutas no staging |
| `scripts/import-planejamento/01-km.ts` | Criar | IMPORTKM → fact_km_frota |
| `scripts/import-planejamento/02-lavagem.ts` | Criar | Lavagem_2 → fact_lavagem |
| `scripts/import-planejamento/03-bateria.ts` | Criar | Bateria - Garantia → fact_bateria_garantia |
| `scripts/import-planejamento/04-kit-seguranca.ts` | Criar | KIT DE SEGURANÇA → fact_kit_seguranca |
| `scripts/import-planejamento/05-estepes.ts` | Criar | Controle de Estepes → fact_estepes |
| `scripts/import-planejamento/06-disponibilidade.ts` | Criar | DISPOBILIDADE TOTAL + Disponib. Tipo Frota |
| `scripts/import-planejamento/run-all.ts` | Criar | Executa todos os scripts em sequência |

---

## Task 1: Migration 006 — Staging + Fact Tables

**Files:**
- Create: `supabase/migrations/006_planejamento_staging.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/006_planejamento_staging.sql

-- ─── Staging ──────────────────────────────────────────────────────────────────
create table if not exists public.staging_excel_importacao (
  id            bigserial primary key,
  batch_id      uuid not null,
  nome_arquivo  text not null,
  aba_origem    text not null,
  linha_origem  integer not null,
  dados_json    jsonb not null,
  hash_linha    text not null,
  importado_em  timestamptz not null default now(),
  processado    boolean not null default false
);

create index if not exists staging_excel_batch_idx
  on public.staging_excel_importacao (batch_id, aba_origem);
create unique index if not exists staging_excel_dedup_idx
  on public.staging_excel_importacao (batch_id, aba_origem, hash_linha);

-- ─── KM Histórico ─────────────────────────────────────────────────────────────
create table if not exists public.fact_km_frota (
  id            bigserial primary key,
  equipamento   text,
  frota_numero  text,
  km            integer not null,
  importado_em  timestamptz not null default now(),
  batch_id      uuid
);

create index if not exists fact_km_frota_idx on public.fact_km_frota (frota_numero);
create index if not exists fact_km_batch_idx on public.fact_km_frota (batch_id);

-- ─── Lavagem ──────────────────────────────────────────────────────────────────
create table if not exists public.fact_lavagem (
  id               bigserial primary key,
  equipamento      text,
  placa            text,
  frota_numero     text,
  setor            text,
  data_realizada   date,
  intervalo_dias   integer,
  proxima_data     date,
  dias_apos        integer,
  atraso_dias      integer,
  status           text,
  powerapps_id     text,
  batch_id         uuid,
  unique (equipamento, data_realizada)
);

create index if not exists fact_lavagem_equip_idx on public.fact_lavagem (equipamento);
create index if not exists fact_lavagem_status_idx on public.fact_lavagem (status);

-- ─── Bateria ──────────────────────────────────────────────────────────────────
create table if not exists public.fact_bateria_garantia (
  id             bigserial primary key,
  equipamento    text,
  placa          text,
  frota_numero   text,
  setor          text,
  data_compra    date,
  modelo_bateria text,
  loja           text,
  orcamento      bigint,
  batch_id       uuid,
  unique (equipamento)
);

-- ─── Kit de Segurança ─────────────────────────────────────────────────────────
create table if not exists public.fact_kit_seguranca (
  id                bigserial primary key,
  equipamento       text,
  placa             text,
  frota_numero      text,
  setor             text,
  triangulo_ok      boolean,
  extintor_ok       boolean,
  macaco_ok         boolean,
  chave_roda_ok     boolean,
  data_verificacao  date,
  batch_id          uuid,
  unique (equipamento)
);

-- ─── Estepes ──────────────────────────────────────────────────────────────────
create table if not exists public.fact_estepes (
  id               bigserial primary key,
  frota_numero     text,
  placa            text,
  modelo           text,
  ano              integer,
  local            text,
  setor            text,
  tem_estepe       boolean,
  data_verificacao date,
  batch_id         uuid,
  unique (placa)
);

-- ─── Disponibilidade Diária ───────────────────────────────────────────────────
create table if not exists public.fact_disponibilidade_diaria (
  id              bigserial primary key,
  data            date not null unique,
  total           integer,
  parados         integer,
  disponibilidade numeric(6,4),
  meta            numeric(6,4),
  batch_id        uuid
);

create index if not exists fact_disp_diaria_data_idx on public.fact_disponibilidade_diaria (data desc);

-- ─── Disponibilidade por Tipo ─────────────────────────────────────────────────
create table if not exists public.fact_disponibilidade_tipo_frota (
  id               bigserial primary key,
  data             date not null,
  tipo_equipamento text not null,
  total            integer,
  parados          integer,
  disponibilidade  numeric(6,4),
  batch_id         uuid,
  unique (data, tipo_equipamento)
);

create index if not exists fact_disp_tipo_data_idx on public.fact_disponibilidade_tipo_frota (data desc);

-- ─── Comparativo de Ordens ────────────────────────────────────────────────────
create table if not exists public.fact_comparativo_ordens (
  id           bigserial primary key,
  data_periodo date not null unique,
  qtd_ordens   integer,
  valor_total  numeric(14,2),
  batch_id     uuid
);

-- ─── Manutencao Programada (Sub-projeto B — criada aqui para não precisar de nova migration) ──
create table if not exists public.fact_manutencao_programada (
  id              bigserial primary key,
  equipamento     text,
  placa           text,
  frota_numero    text,
  local           text,
  setor           text,
  tipo_servico    text check (tipo_servico in (
    'AR_CONDICIONADO','ALINHAMENTO','PREVENTIVA_MOTOR',
    'EMBREAGEM','TACOGRAFO','PORTA_ROOL_UP','SUSPENSAO'
  )),
  data_realizada  date,
  km_inicial      integer,
  km_rodados      integer,
  media_intervalo integer,
  desvio          integer,
  status          text,
  batch_id        uuid,
  unique (equipamento, tipo_servico)
);

create index if not exists fact_manut_prog_equip_idx on public.fact_manutencao_programada (equipamento);
create index if not exists fact_manut_prog_status_idx on public.fact_manutencao_programada (status);

-- ─── Pneus (Sub-projeto B) ────────────────────────────────────────────────────
create table if not exists public.fact_pneus (
  id                   bigserial primary key,
  equipamento          text,
  frota_numero         text,
  km_frota             integer,
  posicao              text,
  numero_fogo          text,
  marca                text,
  dt_montagem          date,
  dt_atualizado        date,
  numero_fogo_anterior text,
  marca_anterior       text,
  status               text,
  marcado              boolean,
  observacoes          text,
  batch_id             uuid,
  unique (equipamento, posicao)
);

-- ─── Documentos (Sub-projeto B) ───────────────────────────────────────────────
create table if not exists public.fact_documentos_frota (
  id               bigserial primary key,
  equipamento      text,
  placa            text,
  frota_numero     text,
  tipo_documento   text check (tipo_documento in ('TACOGRAFO','CRLV','DUT')),
  data_realizada   date,
  media_dias       integer,
  dias_passados    integer,
  desvio           integer,
  data_vencimento  date,
  status           text,
  link_documento   text,
  localizacao      text,
  batch_id         uuid,
  unique (equipamento, tipo_documento)
);

-- ─── Frotas Paradas (Sub-projeto D) ───────────────────────────────────────────
create table if not exists public.fact_frotas_paradas (
  id                   bigserial primary key,
  frota_numero         text,
  placa                text,
  descricao_original   text not null,
  servicos             text,
  classificacao        text,
  oficina              text,
  proxima_programacao  date,
  inicio_em            date,
  prev_saida           date,
  setor                text,
  status               text,
  ia_texto_corrigido   text,
  ia_classificacao     text,
  ia_criticidade       text check (ia_criticidade is null or ia_criticidade in ('BAIXA','MEDIA','ALTA','CRITICA')),
  ia_acao_recomendada  text,
  ia_justificativa     text,
  ia_analisado_em      timestamptz,
  batch_id             uuid
);

create index if not exists fact_paradas_frota_idx on public.fact_frotas_paradas (frota_numero);
create index if not exists fact_paradas_criticidade_idx on public.fact_frotas_paradas (ia_criticidade);
```

- [ ] **Step 2: Aplicar no Supabase via MCP**

Usar `mcp__claude_ai_Supabase__apply_migration` com `project_id=nwoqastjgkgsifmxdqwp` e `name=006_planejamento_staging`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_planejamento_staging.sql
git commit -m "feat: migration 006 — staging, fact tables planejamento e disponibilidade"
```

---

## Task 2: Utils compartilhados

**Files:**
- Create: `scripts/import-planejamento/utils.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// scripts/import-planejamento/utils.ts
import { createHash } from "node:crypto";

export function excelDateToIso(serial: unknown): string | null {
  if (serial == null || serial === "" || serial === "-") return null;
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 1) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function normPlaca(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/[\s\-]/g, "").toUpperCase();
  return s.length > 3 ? s : null;
}

export function normStatus(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().toUpperCase().replace(/\s+/g, "_");
  if (s === "" || s === "-" || s === "N/A") return null;
  return s;
}

export function nullify(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "" || s === "-" || s === "N/A" || s === "#N/D" || s === "#REF!") return null;
  return s;
}

export function asInt(v: unknown): number | null {
  if (v == null || v === "" || v === "-") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : Number.isFinite(n) ? Math.round(n) : null;
}

export function asNum(v: unknown): number | null {
  if (v == null || v === "" || v === "-") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function hashLinha(dados: unknown): string {
  return createHash("sha256").update(JSON.stringify(dados)).digest("hex");
}

export function normEquip(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/[^0-9]/g, "");
  return s.length > 0 ? s : null;
}

export function normFrota(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "" || s === "-") return null;
  return s;
}

export function asBool(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toUpperCase();
  if (s === "SIM" || s === "TRUE" || s === "1" || s === "S") return true;
  if (s === "NÃO" || s === "NAO" || s === "FALSE" || s === "0" || s === "N") return false;
  const n = Number(v);
  if (Number.isFinite(n) && n > 40000) return true; // data serial = presente
  return null;
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd c:\frotas && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add scripts/import-planejamento/utils.ts
git commit -m "feat: utils de importação — datas Excel, normalização, hash"
```

---

## Task 3: Script 00 — Staging loader

Carrega todas as abas brutas em `staging_excel_importacao`.

**Files:**
- Create: `scripts/import-planejamento/00-staging.ts`

- [ ] **Step 1: Criar o script**

```typescript
// scripts/import-planejamento/00-staging.ts
import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { hashLinha } from "./utils";

const XLSX_PATH =
  process.env.XLSX_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

const BATCH_SIZE = 200;

export async function runStaging(batchId: string): Promise<void> {
  console.log(`[00-staging] Lendo ${XLSX_PATH}...`);
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const nomeArquivo = XLSX_PATH.split(/[\\/]/).pop() ?? XLSX_PATH;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });
    if (rows.length < 2) continue;

    const payload: Array<{
      batch_id: string; nome_arquivo: string; aba_origem: string;
      linha_origem: number; dados_json: unknown; hash_linha: string;
    }> = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] as unknown[];
      const allNull = r.every((c) => c == null || c === "");
      if (allNull) continue;
      const dados = Object.fromEntries(r.map((v, j) => [j, v]));
      payload.push({
        batch_id: batchId,
        nome_arquivo: nomeArquivo,
        aba_origem: sheetName,
        linha_origem: i + 1,
        dados_json: dados,
        hash_linha: hashLinha(dados),
      });
    }

    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const chunk = payload.slice(i, i + BATCH_SIZE);
      const { error } = await supabaseManutencao
        .from("staging_excel_importacao")
        .upsert(chunk, { onConflict: "batch_id,aba_origem,hash_linha", ignoreDuplicates: true });
      if (error) console.warn(`[staging] aba=${sheetName} erro:`, error.message);
    }
    console.log(`  [staging] ${sheetName}: ${payload.length} linhas`);
  }
}

if (require.main === module) {
  const batchId = randomUUID();
  console.log(`batch_id: ${batchId}`);
  runStaging(batchId)
    .then(() => { console.log("Staging concluído"); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Rodar o staging**

```bash
cd c:\frotas && npx tsx scripts/import-planejamento/00-staging.ts
```

Esperado: lista de abas com contagem de linhas, sem erros críticos.

- [ ] **Step 3: Verificar no Supabase**

```sql
SELECT aba_origem, COUNT(*) FROM staging_excel_importacao GROUP BY aba_origem ORDER BY 2 DESC;
```

Esperado: ~19 abas, total ~30.000+ linhas.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-planejamento/00-staging.ts
git commit -m "feat: script 00-staging — carrega todas as abas do PLANEJAMENTO no staging"
```

---

## Task 4: Script 01 — KM histórico

**Files:**
- Create: `scripts/import-planejamento/01-km.ts`

- [ ] **Step 1: Criar o script**

```typescript
// scripts/import-planejamento/01-km.ts
import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { asInt, normFrota } from "./utils";

const XLSX_PATH =
  process.env.XLSX_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";
const BATCH_SIZE = 500;

// Aba IMPORTKM: col0=Frota, col1=KM, col2=Comb (ignorado)
// Linha 0 = cabeçalho, dados de linha 1 em diante
export async function runKm(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const ws = wb.Sheets["IMPORTKM"];
  if (!ws) throw new Error("Aba IMPORTKM não encontrada");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const payload: Array<{ frota_numero: string | null; km: number; equipamento: null; batch_id: string }> = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const frota = normFrota(r[0]);
    const km = asInt(r[1]);
    if (frota == null || km == null || km <= 0) continue;
    payload.push({ frota_numero: frota, km, equipamento: null, batch_id: batchId });
  }

  let inserted = 0;
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const chunk = payload.slice(i, i + BATCH_SIZE);
    const { error } = await supabaseManutencao.from("fact_km_frota").insert(chunk);
    if (error) console.warn("[01-km] erro:", error.message);
    else inserted += chunk.length;
  }
  console.log(`[01-km] ${inserted} registros de KM inseridos`);
}

if (require.main === module) {
  const batchId = randomUUID();
  runKm(batchId)
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Rodar**

```bash
npx tsx scripts/import-planejamento/01-km.ts
```

Esperado: `~24.500 registros de KM inseridos`.

- [ ] **Step 3: Verificar**

```sql
SELECT COUNT(*), MIN(km), MAX(km) FROM fact_km_frota;
```

- [ ] **Step 4: Commit**

```bash
git add scripts/import-planejamento/01-km.ts
git commit -m "feat: script 01-km — IMPORTKM → fact_km_frota (24k registros)"
```

---

## Task 5: Script 02 — Lavagem

**Files:**
- Create: `scripts/import-planejamento/02-lavagem.ts`

- [ ] **Step 1: Criar o script**

```typescript
// scripts/import-planejamento/02-lavagem.ts
import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { excelDateToIso, normEquip, normPlaca, normFrota, normStatus, nullify, asInt } from "./utils";

const XLSX_PATH =
  process.env.XLSX_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

// Aba Lavagem_2
// col0=EQUIP, col1=Placa, col2=Frota, col3=Setor,
// col4=Data manutenção, col5=Próxima lavagem(dias), col6=Data próxima,
// col7=Dias após, col8=Atraso, col9=Status, col10=PowerAppsId
export async function runLavagem(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const ws = wb.Sheets["Lavagem_2"];
  if (!ws) throw new Error("Aba Lavagem_2 não encontrada");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const payload = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const equip = normEquip(r[0]);
    const placa = normPlaca(r[1]);
    if (!equip && !placa) continue;
    payload.push({
      equipamento: equip,
      placa,
      frota_numero: normFrota(r[2]),
      setor: nullify(r[3]),
      data_realizada: excelDateToIso(r[4]),
      intervalo_dias: asInt(r[5]),
      proxima_data: excelDateToIso(r[6]),
      dias_apos: asInt(r[7]),
      atraso_dias: asInt(r[8]),
      status: normStatus(r[9]),
      powerapps_id: nullify(r[10]),
      batch_id: batchId,
    });
  }

  const { error, count } = await supabaseManutencao
    .from("fact_lavagem")
    .upsert(payload, { onConflict: "equipamento,data_realizada", ignoreDuplicates: false })
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  console.log(`[02-lavagem] ${payload.length} registros upserted`);
}

if (require.main === module) {
  const batchId = randomUUID();
  runLavagem(batchId)
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Rodar**

```bash
npx tsx scripts/import-planejamento/02-lavagem.ts
```

Esperado: `188 registros upserted`.

- [ ] **Step 3: Verificar**

```sql
SELECT status, COUNT(*) FROM fact_lavagem GROUP BY status;
```

- [ ] **Step 4: Commit**

```bash
git add scripts/import-planejamento/02-lavagem.ts
git commit -m "feat: script 02-lavagem — Lavagem_2 → fact_lavagem"
```

---

## Task 6: Script 03 — Bateria

**Files:**
- Create: `scripts/import-planejamento/03-bateria.ts`

- [ ] **Step 1: Criar o script**

```typescript
// scripts/import-planejamento/03-bateria.ts
import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { excelDateToIso, normEquip, normPlaca, normFrota, nullify, asInt } from "./utils";

const XLSX_PATH =
  process.env.XLSX_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

// Aba Bateria - Garantia
// col0=EQUIP, col1=PLACA, col2=FROTAS, col3=SETOR,
// col4=DATA COMPRA, col5=MODELO BATERIA, col6=LOJA, col7=ORÇAMENTO
export async function runBateria(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const ws = wb.Sheets["Bateria - Garantia"];
  if (!ws) throw new Error("Aba Bateria - Garantia não encontrada");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const payload = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const equip = normEquip(r[0]);
    if (!equip) continue;
    payload.push({
      equipamento: equip,
      placa: normPlaca(r[1]),
      frota_numero: normFrota(r[2]),
      setor: nullify(r[3]),
      data_compra: excelDateToIso(r[4]),
      modelo_bateria: nullify(r[5]),
      loja: nullify(r[6]),
      orcamento: asInt(r[7]),
      batch_id: batchId,
    });
  }

  const { error } = await supabaseManutencao
    .from("fact_bateria_garantia")
    .upsert(payload, { onConflict: "equipamento" });
  if (error) throw error;
  console.log(`[03-bateria] ${payload.length} registros upserted`);
}

if (require.main === module) {
  const batchId = randomUUID();
  runBateria(batchId)
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Rodar**

```bash
npx tsx scripts/import-planejamento/03-bateria.ts
```

Esperado: `~168 registros upserted`.

- [ ] **Step 3: Commit**

```bash
git add scripts/import-planejamento/03-bateria.ts
git commit -m "feat: script 03-bateria — Bateria - Garantia → fact_bateria_garantia"
```

---

## Task 7: Script 04 — Kit de Segurança

**Files:**
- Create: `scripts/import-planejamento/04-kit-seguranca.ts`

- [ ] **Step 1: Criar o script**

```typescript
// scripts/import-planejamento/04-kit-seguranca.ts
import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { excelDateToIso, normEquip, normPlaca, normFrota, nullify, asBool } from "./utils";

const XLSX_PATH =
  process.env.XLSX_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

// Aba KIT DE SEGURANÇA
// col0=EQUIP, col1=PLACAS, col2=FROTAS, col3=SETOR,
// col4=TRIANGULO, col5=EXTINTOR, col6=MACACO, col7=CHAVE DE RODA
// Quando a coluna tem data serial = item presente/verificado
// Quando null = não verificado
export async function runKitSeguranca(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const ws = wb.Sheets["KIT DE SEGURANÇA"];
  if (!ws) throw new Error("Aba KIT DE SEGURANÇA não encontrada");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const payload = [];
  let dataVerif: string | null = null;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const equip = normEquip(r[0]);
    if (!equip) continue;

    const triDate = excelDateToIso(r[4]);
    if (triDate) dataVerif = triDate;

    payload.push({
      equipamento: equip,
      placa: normPlaca(r[1]),
      frota_numero: normFrota(r[2]),
      setor: nullify(r[3]),
      triangulo_ok: r[4] != null && r[4] !== "" && r[4] !== "-",
      extintor_ok:  r[5] != null && r[5] !== "" && r[5] !== "-",
      macaco_ok:    r[6] != null && r[6] !== "" && r[6] !== "-",
      chave_roda_ok: r[7] != null && r[7] !== "" && r[7] !== "-",
      data_verificacao: triDate,
      batch_id: batchId,
    });
  }

  const { error } = await supabaseManutencao
    .from("fact_kit_seguranca")
    .upsert(payload, { onConflict: "equipamento" });
  if (error) throw error;
  console.log(`[04-kit-seguranca] ${payload.length} registros upserted`);
}

if (require.main === module) {
  const batchId = randomUUID();
  runKitSeguranca(batchId)
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Rodar**

```bash
npx tsx scripts/import-planejamento/04-kit-seguranca.ts
```

Esperado: `~282 registros upserted`.

- [ ] **Step 3: Commit**

```bash
git add scripts/import-planejamento/04-kit-seguranca.ts
git commit -m "feat: script 04-kit-seguranca — KIT DE SEGURANÇA → fact_kit_seguranca"
```

---

## Task 8: Script 05 — Estepes

**Files:**
- Create: `scripts/import-planejamento/05-estepes.ts`

- [ ] **Step 1: Criar o script**

```typescript
// scripts/import-planejamento/05-estepes.ts
import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { excelDateToIso, normPlaca, normFrota, nullify, asInt } from "./utils";

const XLSX_PATH =
  process.env.XLSX_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

// Aba Controle de Estepes
// col0=FROTA, col1=PLACA, col2=MODELO, col3=ANO, col4=IDADE,
// col5=LOCAL, col6=SETOR, col7=ESTEPE, col8=DATA VERIFICAÇÃO
export async function runEstepes(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const ws = wb.Sheets["Controle de Estepes"];
  if (!ws) throw new Error("Aba Controle de Estepes não encontrada");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const payload = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const placa = normPlaca(r[1]);
    if (!placa) continue;
    const estepeVal = String(r[7] ?? "").trim().toUpperCase();
    payload.push({
      frota_numero: normFrota(r[0]),
      placa,
      modelo: nullify(r[2]),
      ano: asInt(r[3]),
      local: nullify(r[5]),
      setor: nullify(r[6]),
      tem_estepe: estepeVal === "SIM",
      data_verificacao: excelDateToIso(r[8]),
      batch_id: batchId,
    });
  }

  const { error } = await supabaseManutencao
    .from("fact_estepes")
    .upsert(payload, { onConflict: "placa" });
  if (error) throw error;
  console.log(`[05-estepes] ${payload.length} registros upserted`);
}

if (require.main === module) {
  const batchId = randomUUID();
  runEstepes(batchId)
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Rodar**

```bash
npx tsx scripts/import-planejamento/05-estepes.ts
```

Esperado: `~124 registros upserted`.

- [ ] **Step 3: Commit**

```bash
git add scripts/import-planejamento/05-estepes.ts
git commit -m "feat: script 05-estepes — Controle de Estepes → fact_estepes"
```

---

## Task 9: Script 06 — Disponibilidade

**Files:**
- Create: `scripts/import-planejamento/06-disponibilidade.ts`

- [ ] **Step 1: Criar o script**

```typescript
// scripts/import-planejamento/06-disponibilidade.ts
import "dotenv/config";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { excelDateToIso, asInt, asNum, nullify } from "./utils";

const XLSX_PATH =
  process.env.XLSX_PATH ||
  "C:\\Users\\21664\\Downloads\\PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx";

// Aba DISPOBILIDADE TOTAL
// col0=DATA, col1=Total, col2=Parados, col3=Disponibilidade, col4=Meta
// (colunas 5+ = setor — ignorar por ora)
async function runDisponibilidadeDiaria(wb: XLSX.WorkBook, batchId: string): Promise<void> {
  const ws = wb.Sheets["DISPOBILIDADE TOTAL"];
  if (!ws) return;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const payload = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const data = excelDateToIso(r[0]);
    if (!data) continue;
    const total = asInt(r[1]);
    const parados = asInt(r[2]);
    const disp = asNum(r[3]);
    const meta = asNum(r[4]);
    if (total == null) continue;
    payload.push({ data, total, parados, disponibilidade: disp, meta, batch_id: batchId });
  }

  const { error } = await supabaseManutencao
    .from("fact_disponibilidade_diaria")
    .upsert(payload, { onConflict: "data" });
  if (error) throw error;
  console.log(`[06-disp-diaria] ${payload.length} registros`);
}

// Aba Disponib. Tipo Frota
// col0=DATA, col1=TIPO, col2=TOTAL, col3=PARADOS, col4=DISPONIBILIDADE
async function runDisponibilidadeTipo(wb: XLSX.WorkBook, batchId: string): Promise<void> {
  const ws = wb.Sheets["Disponib. Tipo Frota"];
  if (!ws) return;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  const payload = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const data = excelDateToIso(r[0]);
    const tipo = nullify(r[1]);
    if (!data || !tipo) continue;
    const total = asInt(r[2]);
    if (total == null) continue;
    payload.push({
      data,
      tipo_equipamento: tipo.trim().toUpperCase(),
      total,
      parados: asInt(r[3]),
      disponibilidade: asNum(r[4]),
      batch_id: batchId,
    });
  }

  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500);
    const { error } = await supabaseManutencao
      .from("fact_disponibilidade_tipo_frota")
      .upsert(chunk, { onConflict: "data,tipo_equipamento" });
    if (error) throw error;
  }
  console.log(`[06-disp-tipo] ${payload.length} registros`);
}

export async function runDisponibilidade(batchId: string): Promise<void> {
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  await runDisponibilidadeDiaria(wb, batchId);
  await runDisponibilidadeTipo(wb, batchId);
}

if (require.main === module) {
  const batchId = randomUUID();
  runDisponibilidade(batchId)
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Rodar**

```bash
npx tsx scripts/import-planejamento/06-disponibilidade.ts
```

Esperado: `~375 registros diários` e `~1068 registros por tipo`.

- [ ] **Step 3: Verificar**

```sql
SELECT MIN(data), MAX(data), COUNT(*) FROM fact_disponibilidade_diaria;
SELECT tipo_equipamento, COUNT(*) FROM fact_disponibilidade_tipo_frota GROUP BY 1;
```

- [ ] **Step 4: Commit**

```bash
git add scripts/import-planejamento/06-disponibilidade.ts
git commit -m "feat: script 06-disponibilidade — disponibilidade diária e por tipo de frota"
```

---

## Task 10: Script run-all + verificação final

**Files:**
- Create: `scripts/import-planejamento/run-all.ts`

- [ ] **Step 1: Criar o orquestrador**

```typescript
// scripts/import-planejamento/run-all.ts
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { runStaging } from "./00-staging";
import { runKm } from "./01-km";
import { runLavagem } from "./02-lavagem";
import { runBateria } from "./03-bateria";
import { runKitSeguranca } from "./04-kit-seguranca";
import { runEstepes } from "./05-estepes";
import { runDisponibilidade } from "./06-disponibilidade";

(async () => {
  const batchId = randomUUID();
  console.log(`\n=== PLANEJAMENTO IMPORT ===`);
  console.log(`batch_id: ${batchId}\n`);

  await runStaging(batchId);
  await runKm(batchId);
  await runLavagem(batchId);
  await runBateria(batchId);
  await runKitSeguranca(batchId);
  await runEstepes(batchId);
  await runDisponibilidade(batchId);

  console.log("\n=== CONCLUÍDO ===");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Rodar completo**

```bash
cd c:\frotas && npx tsx scripts/import-planejamento/run-all.ts
```

Esperado: todos os scripts executam sem erros, linha final `=== CONCLUÍDO ===`.

- [ ] **Step 3: Verificação final de contagem**

```sql
SELECT 'fact_km_frota' as tabela, COUNT(*) FROM fact_km_frota
UNION ALL SELECT 'fact_lavagem', COUNT(*) FROM fact_lavagem
UNION ALL SELECT 'fact_bateria_garantia', COUNT(*) FROM fact_bateria_garantia
UNION ALL SELECT 'fact_kit_seguranca', COUNT(*) FROM fact_kit_seguranca
UNION ALL SELECT 'fact_estepes', COUNT(*) FROM fact_estepes
UNION ALL SELECT 'fact_disponibilidade_diaria', COUNT(*) FROM fact_disponibilidade_diaria
UNION ALL SELECT 'fact_disponibilidade_tipo_frota', COUNT(*) FROM fact_disponibilidade_tipo_frota
UNION ALL SELECT 'staging_excel_importacao', COUNT(*) FROM staging_excel_importacao;
```

Esperado (aproximado):
- fact_km_frota: ~24.500
- fact_lavagem: ~188
- fact_bateria_garantia: ~168
- fact_kit_seguranca: ~282
- fact_estepes: ~124
- fact_disponibilidade_diaria: ~375
- fact_disponibilidade_tipo_frota: ~1.068
- staging: ~30.000+

- [ ] **Step 4: Commit final**

```bash
git add scripts/import-planejamento/run-all.ts
git commit -m "feat: run-all — orquestrador de importação do PLANEJAMENTO (Sub-projeto A)"
```

---

## Self-Review — Cobertura do Spec

| Requisito | Atendido por |
|---|---|
| Não perder dado original | staging_excel_importacao preserva tudo |
| Salvar tudo primeiro em staging | Task 3 (00-staging) |
| Converter datas corretamente | `excelDateToIso` em utils.ts |
| Tratar "-" como nulo | `nullify()` em utils.ts |
| Padronizar placa | `normPlaca()` |
| Padronizar status | `normStatus()` |
| `staging_excel_importacao` com batch_id, hash, dedup | Migration 006 + Tasks 2-3 |
| `fact_km_frota` | Task 4 |
| `fact_lavagem` | Task 5 |
| `fact_bateria_garantia` | Task 6 |
| `fact_kit_seguranca` | Task 7 |
| `fact_estepes` | Task 8 |
| `fact_disponibilidade_diaria` | Task 9 |
| `fact_disponibilidade_tipo_frota` | Task 9 |
| Idempotência | upsert com onConflict em todos os scripts |
| Sub-projeto B tables (manutencao, pneus, docs) | Criadas na migration 006, scripts em plano separado |
| Sub-projeto D table (frotas_paradas) | Criada na migration 006, script em plano separado |
| Dashboards UI | Sub-projeto C — plano separado |
| ETL complexo (ALINHAMENTO, PNEUS, TACÓGRAFO) | Sub-projeto B — plano separado |
| IA frotas paradas | Sub-projeto D — plano separado |
