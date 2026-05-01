# Sistema de Gestão de Frotas — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um app web Next.js sobre Databricks `manutencao.cd` que substitui o controle manual em `FROTAS 2026.xlsx`, com auth Microsoft Bemol, dashboard, CRUD de frotas com histórico, e envio de relatórios via SendGrid.

**Architecture:** Next.js 16 App Router (TypeScript) na Vercel Fluid Compute. Server Actions e RSC consultam Databricks direto via `@databricks/sql`. Auth via Auth.js v5 (Entra ID), restrito a `@bemol.com.br`. SendGrid para e-mail. Tailwind + shadcn/ui + Recharts no front. Tabelas Delta criadas e populadas via scripts CLI idempotentes.

**Tech Stack:** Next.js 16, TypeScript, `@databricks/sql`, Auth.js v5, `@sendgrid/mail`, Tailwind v4, shadcn/ui, Recharts, `xlsx` (SheetJS), `zod`, `vitest`.

**Reference:** Spec em [`docs/superpowers/specs/2026-04-30-frotas-design.md`](../specs/2026-04-30-frotas-design.md)

---

## Phase 1 — Foundation

### Task 1: Scaffold Next.js + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.eslintrc.json`, `postcss.config.mjs`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Modify: `.env` (já existe — adicionar 3 vars)

- [ ] **Step 1: Criar `package.json` com dependências**

```json
{
  "name": "frotas-bemol",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:init": "tsx scripts/create-schema.ts",
    "import": "tsx scripts/import-xlsx.ts"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@databricks/sql": "^1.10.0",
    "next-auth": "5.0.0-beta.25",
    "@auth/core": "^0.37.0",
    "@sendgrid/mail": "^8.1.4",
    "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
    "zod": "^3.23.8",
    "recharts": "^2.13.0",
    "lucide-react": "^0.468.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.5",
    "@radix-ui/react-dialog": "^1.1.4",
    "@radix-ui/react-dropdown-menu": "^2.1.4",
    "@radix-ui/react-select": "^2.1.4",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-label": "^2.1.1",
    "@radix-ui/react-toast": "^1.2.4",
    "dotenv": "^16.4.7"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.5.0",
    "tsx": "^4.19.2",
    "vitest": "^2.1.8",
    "eslint": "^9.16.0",
    "eslint-config-next": "^16.0.0"
  }
}
```

- [ ] **Step 2: Rodar `npm install`**

```bash
cd /c/frotas && npm install --no-audit --no-fund
```

Expected: instala sem erros. Se algum pacote ainda não for 16.0.0 disponível, pode aceitar o `^15.x` mais recente automaticamente — não é bloqueante.

- [ ] **Step 3: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Criar `next.config.ts`**

```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  serverExternalPackages: ["@databricks/sql"],
};

export default config;
```

`@databricks/sql` precisa ficar fora do bundling porque tem binários nativos.

- [ ] **Step 5: Criar `app/globals.css` com Tailwind v4**

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --primary: 222 47% 25%;          /* azul escuro Bemol */
    --primary-foreground: 0 0% 100%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --border: 214 32% 91%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --success: 158 64% 40%;
    --warning: 38 92% 50%;
  }
  body { background: hsl(var(--background)); color: hsl(var(--foreground)); }
}
```

- [ ] **Step 6: Criar `postcss.config.mjs`**

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

- [ ] **Step 7: Criar `app/layout.tsx` mínimo**

```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Frotas Bemol",
  description: "Sistema de gestão de frotas Bemol",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Criar `app/page.tsx` placeholder**

```tsx
export default function Home() {
  return <main className="p-8 text-2xl">Frotas Bemol — em construção</main>;
}
```

- [ ] **Step 9: Atualizar `.gitignore`**

```
.env
.env.local
node_modules/
.next/
out/
*.tsbuildinfo
next-env.d.ts
.vercel
```

- [ ] **Step 10: Adicionar vars faltantes no `.env`**

Anexar ao `.env` existente:

```
FROM_EMAIL=ordensmanutencao@bemol.com.br
NEXTAUTH_SECRET=<gerar-depois>
NEXTAUTH_URL=http://localhost:3000
```

`NEXTAUTH_SECRET` será gerado num passo posterior; deixe placeholder.

- [ ] **Step 11: Rodar dev server e verificar**

```bash
npm run dev
```

Abrir `http://localhost:3000` — deve mostrar "Frotas Bemol — em construção" estilizado pelo Tailwind. Parar com Ctrl+C.

- [ ] **Step 12: Commit**

```bash
git add .
git commit -m "chore: scaffold Next.js 16 + Tailwind v4 + tooling"
```

---

### Task 2: Setup shadcn/ui + utilitários

**Files:**
- Create: `components.json`, `lib/utils.ts`
- Create: `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/select.tsx`, `components/ui/table.tsx`, `components/ui/dialog.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/badge.tsx`, `components/ui/toast.tsx`, `components/ui/toaster.tsx`, `components/ui/sonner.tsx`

- [ ] **Step 1: Criar `lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR");
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
```

- [ ] **Step 2: Criar `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib" }
}
```

- [ ] **Step 3: Adicionar componentes shadcn via CLI**

```bash
npx shadcn@latest add button card input label select table dialog dropdown-menu badge sonner --yes --overwrite
```

Expected: cria arquivos em `components/ui/`. Se algum prompt aparecer, aceitar defaults.

- [ ] **Step 4: Criar `components/providers.tsx` (toast provider)**

```tsx
"use client";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster richColors position="top-right" />
    </>
  );
}
```

- [ ] **Step 5: Wrap `<Providers>` no `app/layout.tsx`**

Substituir o body por:

```tsx
<body className="min-h-screen antialiased">
  <Providers>{children}</Providers>
</body>
```

E adicionar `import { Providers } from "@/components/providers";` no topo.

- [ ] **Step 6: Verificar**

```bash
npm run typecheck
```

Expected: 0 erros.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: configure shadcn/ui primitives and toast provider"
```

---

### Task 3: Databricks connection helper

**Files:**
- Create: `lib/db.ts`

- [ ] **Step 1: Criar `lib/db.ts`**

```ts
import "server-only";
import { DBSQLClient } from "@databricks/sql";

const SCHEMA = process.env.DATABRICKS_SCHEMA || "manutencao.cd";
export const SCHEMA_FQN = SCHEMA.toLowerCase();

let clientPromise: Promise<DBSQLClient> | null = null;

async function getClient(): Promise<DBSQLClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new DBSQLClient();
      await client.connect({
        host: process.env.DATABRICKS_SERVER_HOSTNAME!,
        path: process.env.DATABRICKS_HTTP_PATH!,
        token: process.env.DATABRICKS_TOKEN!,
      });
      return client;
    })();
  }
  return clientPromise;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await getClient();
  const session = await client.openSession();
  try {
    let bound = sql;
    if (params.length > 0) {
      let i = 0;
      bound = sql.replace(/\?/g, () => formatParam(params[i++]));
    }
    const op = await session.executeStatement(bound, { runAsync: true });
    const rows = await op.fetchAll();
    await op.close();
    return rows as T[];
  } finally {
    await session.close();
  }
}

function formatParam(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return `TIMESTAMP '${v.toISOString().replace("T", " ").replace("Z", "")}'`;
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  await query(sql, params);
}
```

> Nota: `@databricks/sql` não tem prepared statements como Postgres. Fazemos escape manual em `formatParam`. Para inputs do usuário sempre passe via array de params, nunca por interpolação direta.

- [ ] **Step 2: Smoke test manual**

```bash
node -e "require('dotenv').config(); require('tsx/cjs').register; (async () => { const { query } = await import('./lib/db.ts'); console.log(await query('SELECT current_catalog() AS c, current_schema() AS s')); })()"
```

Forma mais simples — criar `scripts/smoke-db.ts`:

```ts
import "dotenv/config";
import { query } from "../lib/db";

(async () => {
  const r = await query<{ c: string; s: string }>("SELECT current_catalog() AS c, current_schema() AS s");
  console.log(r);
  process.exit(0);
})();
```

Rodar: `npx tsx scripts/smoke-db.ts`
Expected: `[ { c: 'hive_metastore', s: 'default' } ]` ou similar — comprova conectividade.

- [ ] **Step 3: Apagar smoke script após confirmar**

```bash
rm scripts/smoke-db.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add Databricks SQL connection helper"
```

---

### Task 4: Criar tabelas no `manutencao.cd`

**Files:**
- Create: `scripts/create-schema.ts`

- [ ] **Step 1: Criar `scripts/create-schema.ts`**

```ts
import "dotenv/config";
import { execute } from "../lib/db";

const SCHEMA = "manutencao.cd";

const ddl = [
  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.frotas (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    frota_geral STRING,
    placa STRING,
    modelo STRING,
    chassi STRING,
    renavam STRING,
    ano_fabricacao INT,
    localizacao STRING,
    km_atual BIGINT,
    status STRING,
    observacoes STRING,
    vendido BOOLEAN,
    ano_venda INT,
    ativo BOOLEAN,
    criado_em TIMESTAMP,
    atualizado_em TIMESTAMP,
    atualizado_por STRING
  ) USING DELTA`,

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.frotas_historico (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    frota_id BIGINT,
    campo STRING,
    valor_antigo STRING,
    valor_novo STRING,
    alterado_em TIMESTAMP,
    alterado_por STRING
  ) USING DELTA`,

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.email_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    tipo STRING,
    frota_id BIGINT,
    destinatarios STRING,
    assunto STRING,
    enviado_em TIMESTAMP,
    enviado_por STRING,
    status STRING,
    erro_msg STRING
  ) USING DELTA`,
];

(async () => {
  for (const stmt of ddl) {
    console.log("Executing:", stmt.split("\n")[0]);
    await execute(stmt);
  }
  console.log("✓ Schema criado com sucesso");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Rodar**

```bash
npm run db:init
```

Expected: 3 linhas "Executing: CREATE TABLE..." + "✓ Schema criado com sucesso"

- [ ] **Step 3: Verificar no Databricks**

```bash
npx tsx -e "import('dotenv').then(d=>d.config()); import('./lib/db').then(async ({query})=>{ console.log(await query('SHOW TABLES IN manutencao.cd')); })"
```

Expected: lista contém `frotas`, `frotas_historico`, `email_logs`.

- [ ] **Step 4: Commit**

```bash
git add scripts/create-schema.ts
git commit -m "feat: add DDL script for manutencao.cd tables"
```

---

### Task 5: `lib/rules.ts` com testes

**Files:**
- Create: `lib/rules.ts`, `lib/rules.test.ts`, `vitest.config.ts`

- [ ] **Step 1: Criar `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

- [ ] **Step 2: Escrever testes failing primeiro (`lib/rules.test.ts`)**

```ts
import { describe, it, expect } from "vitest";
import { calcularStatus, parseVenda, calcularIdade, THRESHOLDS } from "./rules";

describe("calcularIdade", () => {
  it("retorna anoAtual menos anoFabricacao", () => {
    expect(calcularIdade(2019, 2026)).toBe(7);
    expect(calcularIdade(2026, 2026)).toBe(0);
  });
  it("retorna null se ano nulo", () => {
    expect(calcularIdade(null, 2026)).toBe(null);
  });
});

describe("calcularStatus", () => {
  it("retorna 'critico' quando idade > 10", () => {
    expect(calcularStatus(11, 100_000)).toBe("critico");
  });
  it("retorna 'critico' quando km > 600k", () => {
    expect(calcularStatus(2, 700_000)).toBe("critico");
  });
  it("retorna 'atencao' quando idade > 7", () => {
    expect(calcularStatus(8, 100_000)).toBe("atencao");
  });
  it("retorna 'atencao' quando km > 400k", () => {
    expect(calcularStatus(2, 500_000)).toBe("atencao");
  });
  it("retorna 'disponivel' quando dentro dos limites", () => {
    expect(calcularStatus(3, 100_000)).toBe("disponivel");
  });
  it("retorna 'disponivel' quando idade null e km baixo", () => {
    expect(calcularStatus(null, 50_000)).toBe("disponivel");
  });
});

describe("parseVenda", () => {
  it("detecta VENDA com ano", () => {
    expect(parseVenda("VENDA 2026")).toEqual({ vendido: true, anoVenda: 2026 });
    expect(parseVenda("VENDA 2025/2")).toEqual({ vendido: true, anoVenda: 2025 });
  });
  it("detecta VENDA sem ano", () => {
    expect(parseVenda("VENDA")).toEqual({ vendido: true, anoVenda: null });
  });
  it("detecta case-insensitive", () => {
    expect(parseVenda("venda 2024")).toEqual({ vendido: true, anoVenda: 2024 });
  });
  it("retorna não vendido para localização normal", () => {
    expect(parseVenda("AM - MANAUS")).toEqual({ vendido: false, anoVenda: null });
  });
  it("retorna não vendido para null", () => {
    expect(parseVenda(null)).toEqual({ vendido: false, anoVenda: null });
  });
});

describe("THRESHOLDS", () => {
  it("expõe constantes esperadas", () => {
    expect(THRESHOLDS.idadeAtencao).toBe(7);
    expect(THRESHOLDS.idadeCritico).toBe(10);
    expect(THRESHOLDS.kmAtencao).toBe(400_000);
    expect(THRESHOLDS.kmCritico).toBe(600_000);
  });
});
```

- [ ] **Step 3: Rodar testes para confirmar que falham**

```bash
npm run test
```

Expected: tudo falha com "Cannot find module './rules'".

- [ ] **Step 4: Implementar `lib/rules.ts`**

```ts
export const THRESHOLDS = {
  idadeAtencao: 7,
  idadeCritico: 10,
  kmAtencao: 400_000,
  kmCritico: 600_000,
} as const;

export type StatusFrota = "disponivel" | "manutencao" | "atencao" | "critico" | "vendido";

export function calcularIdade(anoFabricacao: number | null, anoAtual: number = new Date().getFullYear()): number | null {
  if (anoFabricacao == null) return null;
  return anoAtual - anoFabricacao;
}

export function calcularStatus(idade: number | null, km: number | null): StatusFrota {
  const i = idade ?? 0;
  const k = km ?? 0;
  if (i > THRESHOLDS.idadeCritico || k > THRESHOLDS.kmCritico) return "critico";
  if (i > THRESHOLDS.idadeAtencao || k > THRESHOLDS.kmAtencao) return "atencao";
  return "disponivel";
}

export function parseVenda(localizacao: string | null): { vendido: boolean; anoVenda: number | null } {
  if (!localizacao) return { vendido: false, anoVenda: null };
  const m = localizacao.match(/^\s*venda(?:\s+(\d{4}))?/i);
  if (!m) return { vendido: false, anoVenda: null };
  const anoVenda = m[1] ? parseInt(m[1], 10) : null;
  return { vendido: true, anoVenda };
}
```

- [ ] **Step 5: Rodar testes — devem passar**

```bash
npm run test
```

Expected: 11 passed.

- [ ] **Step 6: Commit**

```bash
git add lib/rules.ts lib/rules.test.ts vitest.config.ts
git commit -m "feat: add fleet domain rules (status, age, sale parsing) with tests"
```

---

### Task 6: Excel import script

**Files:**
- Create: `scripts/import-xlsx.ts`

- [ ] **Step 1: Criar `scripts/import-xlsx.ts`**

```ts
import "dotenv/config";
import * as XLSX from "xlsx";
import path from "node:path";
import { query, execute } from "../lib/db";
import { calcularIdade, calcularStatus, parseVenda } from "../lib/rules";

const XLSX_PATH = process.env.XLSX_PATH || "C:\\Users\\21664\\Downloads\\FROTAS 2026.xlsx";

type Row = {
  "Frota Geral"?: string | number;
  PLACA?: string;
  "MODELO/ MARCA"?: string;
  CHASSI?: string;
  "RENAVAM "?: string | number;
  ANO?: string | number;
  "LOCALIZAÇÃO"?: string;
};

function s(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
}
function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

(async () => {
  console.log(`Lendo ${XLSX_PATH}...`);
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
  console.log(`${rows.length} linhas na planilha`);

  let inserted = 0, updated = 0, skipped = 0;
  const ano_atual = new Date().getFullYear();

  for (const r of rows) {
    const chassi = s(r.CHASSI);
    if (!chassi) { skipped++; continue; }

    const localizacao = s(r["LOCALIZAÇÃO"]);
    const { vendido, anoVenda } = parseVenda(localizacao);
    const ano = n(r.ANO);
    const idade = calcularIdade(ano, ano_atual);
    const status = vendido ? "vendido" : calcularStatus(idade, null);

    const existing = await query<{ id: number }>(
      `SELECT id FROM manutencao.cd.frotas WHERE chassi = ?`, [chassi]
    );

    const cols = {
      frota_geral: r["Frota Geral"] != null ? String(r["Frota Geral"]) : null,
      placa: s(r.PLACA),
      modelo: s(r["MODELO/ MARCA"]),
      chassi,
      renavam: r["RENAVAM "] != null ? String(r["RENAVAM "]) : null,
      ano_fabricacao: ano,
      localizacao,
      km_atual: null as number | null,
      status,
      observacoes: null as string | null,
      vendido,
      ano_venda: anoVenda,
      ativo: true,
      atualizado_por: "import-script",
    };

    if (existing.length > 0) {
      await execute(
        `UPDATE manutencao.cd.frotas SET
          frota_geral=?, placa=?, modelo=?, renavam=?, ano_fabricacao=?, localizacao=?,
          status=?, vendido=?, ano_venda=?, ativo=?, atualizado_em=current_timestamp(), atualizado_por=?
         WHERE chassi=?`,
        [cols.frota_geral, cols.placa, cols.modelo, cols.renavam, cols.ano_fabricacao,
         cols.localizacao, cols.status, cols.vendido, cols.ano_venda, cols.ativo, cols.atualizado_por, chassi]
      );
      updated++;
    } else {
      await execute(
        `INSERT INTO manutencao.cd.frotas
          (frota_geral, placa, modelo, chassi, renavam, ano_fabricacao, localizacao, km_atual, status, observacoes, vendido, ano_venda, ativo, criado_em, atualizado_em, atualizado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, current_timestamp(), current_timestamp(), ?)`,
        [cols.frota_geral, cols.placa, cols.modelo, cols.chassi, cols.renavam, cols.ano_fabricacao,
         cols.localizacao, cols.km_atual, cols.status, cols.observacoes, cols.vendido, cols.ano_venda, cols.ativo, cols.atualizado_por]
      );
      inserted++;
    }
  }

  console.log(`✓ Inseridas: ${inserted}, atualizadas: ${updated}, ignoradas (sem chassi): ${skipped}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Rodar import**

```bash
npm run import
```

Expected: lê 246 linhas, insere quase todas (algumas podem ser puladas se sem chassi). Saída final: `✓ Inseridas: ~245, atualizadas: 0, ignoradas: ~0-1`.

- [ ] **Step 3: Rodar de novo para confirmar idempotência**

```bash
npm run import
```

Expected: `✓ Inseridas: 0, atualizadas: ~245, ignoradas: ~0-1`. Nenhum duplicado.

- [ ] **Step 4: Validar contagem**

```bash
npx tsx -e "import('dotenv').then(d=>d.config()); import('./lib/db').then(async ({query})=>{ const r = await query('SELECT COUNT(*) AS n, SUM(CASE WHEN vendido THEN 1 ELSE 0 END) AS v FROM manutencao.cd.frotas'); console.log(r); })"
```

Expected: `n` ~245, `v` ~8 (vendidos).

- [ ] **Step 5: Commit**

```bash
git add scripts/import-xlsx.ts
git commit -m "feat: add idempotent xlsx import script"
```

---

## Phase 2 — Auth

### Task 7: Auth.js v5 com Microsoft Entra ID

**Files:**
- Create: `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `middleware.ts`
- Create: `app/(auth)/login/page.tsx`, `types/next-auth.d.ts`
- Modify: `.env` (gerar `NEXTAUTH_SECRET`)

- [ ] **Step 1: Gerar `NEXTAUTH_SECRET`**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copiar o output e substituir o placeholder no `.env`:

```
NEXTAUTH_SECRET=<output-do-node>
```

- [ ] **Step 2: Criar `lib/auth.ts`**

```ts
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN || "bemol.com.br").toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT}/v2.0`,
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase() ?? "";
      return email.endsWith(`@${allowedDomain}`);
    },
    async session({ session, token }) {
      if (session.user && token.email) session.user.email = token.email;
      return session;
    },
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
});
```

- [ ] **Step 3: Criar `app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 4: Criar `middleware.ts`**

```ts
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/api/auth");
  if (!req.auth && !isPublic) {
    const url = new URL("/login", req.url);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

- [ ] **Step 5: Criar `app/(auth)/login/page.tsx`**

```tsx
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted">
      <div className="w-full max-w-md rounded-2xl bg-card p-10 shadow-lg">
        <h1 className="text-2xl font-semibold text-card-foreground">Frotas Bemol</h1>
        <p className="mt-2 text-sm text-muted-foreground">Entre com sua conta corporativa.</p>
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/" });
          }}
          className="mt-8"
        >
          <Button type="submit" className="w-full">Entrar com Microsoft</Button>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">
          Acesso restrito a contas <strong>@bemol.com.br</strong>.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Criar `types/next-auth.d.ts` (tipos da sessão)**

```ts
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: { name?: string | null; email: string; image?: string | null };
  }
}
```

- [ ] **Step 7: Configurar redirect URI no Entra ID (manual)**

> Manual no Azure Portal — pode ser feito pelo TI Bemol. Adicionar redirect URI:
> - `http://localhost:3000/api/auth/callback/microsoft-entra-id` (dev)
> - `https://<dominio-vercel>/api/auth/callback/microsoft-entra-id` (prod, depois)

Se o TI já configurou o app, este passo é só verificar.

- [ ] **Step 8: Testar login local**

```bash
npm run dev
```

Abrir `http://localhost:3000` → deve redirecionar para `/login` → clicar no botão → Microsoft → de volta pra `/`. Tentar e-mail externo → deve recusar (mensagem do Auth.js).

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: add Microsoft Entra ID auth with bemol.com.br domain restriction"
```

---

## Phase 3 — Domain Layer

### Task 8: Repos (read methods)

**Files:**
- Create: `lib/repos/frotas.ts`, `lib/repos/frotas.test.ts` (smoke), `lib/repos/historico.ts`, `lib/repos/email-logs.ts`

- [ ] **Step 1: Criar `lib/repos/frotas.ts` com tipos e leitura**

```ts
import "server-only";
import { query } from "@/lib/db";
import type { StatusFrota } from "@/lib/rules";

export type Frota = {
  id: number;
  frota_geral: string | null;
  placa: string | null;
  modelo: string | null;
  chassi: string | null;
  renavam: string | null;
  ano_fabricacao: number | null;
  localizacao: string | null;
  km_atual: number | null;
  status: StatusFrota | null;
  observacoes: string | null;
  vendido: boolean;
  ano_venda: number | null;
  ativo: boolean;
  criado_em: string | null;
  atualizado_em: string | null;
  atualizado_por: string | null;
};

export type FrotaFilters = {
  search?: string;
  modelo?: string;
  localizacao?: string;
  ano?: number;
  status?: StatusFrota;
  vendidos?: boolean;
  page?: number;
  pageSize?: number;
};

const T = "manutencao.cd.frotas";

function buildWhere(f: FrotaFilters): { sql: string; params: unknown[] } {
  const wh: string[] = [];
  const p: unknown[] = [];
  wh.push("ativo = TRUE");
  wh.push(f.vendidos ? "vendido = TRUE" : "vendido = FALSE");
  if (f.search) {
    wh.push(`(LOWER(placa) LIKE ? OR LOWER(chassi) LIKE ? OR LOWER(modelo) LIKE ?)`);
    const q = `%${f.search.toLowerCase()}%`;
    p.push(q, q, q);
  }
  if (f.modelo) { wh.push("modelo = ?"); p.push(f.modelo); }
  if (f.localizacao) { wh.push("localizacao = ?"); p.push(f.localizacao); }
  if (f.ano) { wh.push("ano_fabricacao = ?"); p.push(f.ano); }
  if (f.status) { wh.push("status = ?"); p.push(f.status); }
  return { sql: wh.join(" AND "), params: p };
}

export async function listFrotas(f: FrotaFilters = {}): Promise<{ rows: Frota[]; total: number }> {
  const { sql, params } = buildWhere(f);
  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const [rows, totalResult] = await Promise.all([
    query<Frota>(`SELECT * FROM ${T} WHERE ${sql} ORDER BY id LIMIT ${pageSize} OFFSET ${offset}`, params),
    query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${T} WHERE ${sql}`, params),
  ]);
  return { rows, total: Number(totalResult[0]?.n ?? 0) };
}

export async function getFrota(id: number): Promise<Frota | null> {
  const r = await query<Frota>(`SELECT * FROM ${T} WHERE id = ?`, [id]);
  return r[0] ?? null;
}

export type Kpis = {
  total_ativos: number;
  total_atencao: number;
  total_critico: number;
  total_manutencao: number;
  idade_media: number | null;
  km_medio: number | null;
};

export async function kpis(): Promise<Kpis> {
  const r = await query<Kpis & { ano_atual: number }>(
    `SELECT
      COUNT(*) FILTER (WHERE ativo AND NOT vendido) AS total_ativos,
      COUNT(*) FILTER (WHERE status = 'atencao' AND ativo AND NOT vendido) AS total_atencao,
      COUNT(*) FILTER (WHERE status = 'critico' AND ativo AND NOT vendido) AS total_critico,
      COUNT(*) FILTER (WHERE status = 'manutencao' AND ativo AND NOT vendido) AS total_manutencao,
      AVG(year(current_date()) - ano_fabricacao) FILTER (WHERE ativo AND NOT vendido) AS idade_media,
      AVG(km_atual) FILTER (WHERE ativo AND NOT vendido) AS km_medio
    FROM ${T}`
  );
  return {
    total_ativos: Number(r[0].total_ativos ?? 0),
    total_atencao: Number(r[0].total_atencao ?? 0),
    total_critico: Number(r[0].total_critico ?? 0),
    total_manutencao: Number(r[0].total_manutencao ?? 0),
    idade_media: r[0].idade_media != null ? Number(r[0].idade_media) : null,
    km_medio: r[0].km_medio != null ? Number(r[0].km_medio) : null,
  };
}

export async function modelosDistintos(): Promise<string[]> {
  const r = await query<{ modelo: string }>(`SELECT DISTINCT modelo FROM ${T} WHERE modelo IS NOT NULL ORDER BY modelo`);
  return r.map((x) => x.modelo);
}
export async function localizacoesDistintas(): Promise<string[]> {
  const r = await query<{ localizacao: string }>(`SELECT DISTINCT localizacao FROM ${T} WHERE localizacao IS NOT NULL ORDER BY localizacao`);
  return r.map((x) => x.localizacao);
}
```

> Nota: Databricks SQL suporta `FILTER (WHERE …)` em agregados — confirmado no Photon engine.

- [ ] **Step 2: Criar `lib/repos/historico.ts`**

```ts
import "server-only";
import { query, execute } from "@/lib/db";

export type HistoricoEntry = {
  id: number;
  frota_id: number;
  campo: string;
  valor_antigo: string | null;
  valor_novo: string | null;
  alterado_em: string;
  alterado_por: string;
};

export async function listHistorico(frotaId: number): Promise<HistoricoEntry[]> {
  return query<HistoricoEntry>(
    `SELECT * FROM manutencao.cd.frotas_historico WHERE frota_id = ? ORDER BY alterado_em DESC LIMIT 200`,
    [frotaId]
  );
}

export async function appendHistorico(
  frotaId: number, campo: string, valorAntigo: string | null, valorNovo: string | null, userEmail: string
) {
  await execute(
    `INSERT INTO manutencao.cd.frotas_historico (frota_id, campo, valor_antigo, valor_novo, alterado_em, alterado_por)
     VALUES (?, ?, ?, ?, current_timestamp(), ?)`,
    [frotaId, campo, valorAntigo, valorNovo, userEmail]
  );
}

export async function listHistoricoKm(frotaId: number): Promise<{ alterado_em: string; valor_novo: string }[]> {
  return query(
    `SELECT alterado_em, valor_novo FROM manutencao.cd.frotas_historico
     WHERE frota_id = ? AND campo = 'km' ORDER BY alterado_em ASC`,
    [frotaId]
  );
}
```

- [ ] **Step 3: Criar `lib/repos/email-logs.ts`**

```ts
import "server-only";
import { execute } from "@/lib/db";

export async function logEmail(args: {
  tipo: "geral" | "individual";
  frotaId?: number | null;
  destinatarios: string;
  assunto: string;
  enviadoPor: string;
  status: "enviado" | "erro";
  erroMsg?: string | null;
}) {
  await execute(
    `INSERT INTO manutencao.cd.email_logs
      (tipo, frota_id, destinatarios, assunto, enviado_em, enviado_por, status, erro_msg)
     VALUES (?, ?, ?, ?, current_timestamp(), ?, ?, ?)`,
    [args.tipo, args.frotaId ?? null, args.destinatarios, args.assunto, args.enviadoPor, args.status, args.erroMsg ?? null]
  );
}
```

- [ ] **Step 4: Smoke test manual**

Criar `scripts/smoke-repos.ts`:

```ts
import "dotenv/config";
import { listFrotas, kpis } from "../lib/repos/frotas";

(async () => {
  const k = await kpis();
  console.log("KPIs:", k);
  const { rows, total } = await listFrotas({ pageSize: 5 });
  console.log(`Total: ${total}, primeiras 5:`, rows.map((r) => ({ id: r.id, placa: r.placa, modelo: r.modelo })));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
```

```bash
npx tsx scripts/smoke-repos.ts
```

Expected: KPIs com números > 0; lista com 5 frotas; total ~237 (ativas e não vendidas).

- [ ] **Step 5: Apagar smoke**

```bash
rm scripts/smoke-repos.ts
```

- [ ] **Step 6: Commit**

```bash
git add lib/repos/
git commit -m "feat: add read repos for frotas, historico, email-logs"
```

---

### Task 9: Repos (write methods)

**Files:**
- Modify: `lib/repos/frotas.ts`

- [ ] **Step 1: Adicionar tipos e métodos de escrita em `lib/repos/frotas.ts`**

Anexar ao final do arquivo:

```ts
import { appendHistorico } from "@/lib/repos/historico";

export type FrotaInput = {
  frota_geral?: string | null;
  placa?: string | null;
  modelo?: string | null;
  chassi: string;
  renavam?: string | null;
  ano_fabricacao?: number | null;
  localizacao?: string | null;
  km_atual?: number | null;
  status?: StatusFrota | null;
  observacoes?: string | null;
};

const TRACKED_FIELDS = ["km_atual", "status", "observacoes", "localizacao"] as const;

export async function createFrota(input: FrotaInput, userEmail: string): Promise<number> {
  await query(
    `INSERT INTO ${T}
      (frota_geral, placa, modelo, chassi, renavam, ano_fabricacao, localizacao, km_atual, status, observacoes, vendido, ano_venda, ativo, criado_em, atualizado_em, atualizado_por)
     VALUES (?,?,?,?,?,?,?,?,?,?, FALSE, NULL, TRUE, current_timestamp(), current_timestamp(), ?)`,
    [input.frota_geral ?? null, input.placa ?? null, input.modelo ?? null, input.chassi,
     input.renavam ?? null, input.ano_fabricacao ?? null, input.localizacao ?? null,
     input.km_atual ?? null, input.status ?? "disponivel", input.observacoes ?? null, userEmail]
  );
  const r = await query<{ id: number }>(`SELECT MAX(id) AS id FROM ${T} WHERE chassi = ?`, [input.chassi]);
  return Number(r[0].id);
}

export async function updateFrota(id: number, input: Partial<FrotaInput>, userEmail: string): Promise<void> {
  const current = await getFrota(id);
  if (!current) throw new Error(`Frota ${id} não encontrada`);

  for (const field of TRACKED_FIELDS) {
    if (field in input) {
      const novo = (input as Record<string, unknown>)[field];
      const antigo = (current as Record<string, unknown>)[field];
      if (String(novo ?? "") !== String(antigo ?? "")) {
        await appendHistorico(id, field === "km_atual" ? "km" : field, String(antigo ?? ""), String(novo ?? ""), userEmail);
      }
    }
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    params.push(v);
  }
  if (sets.length === 0) return;
  sets.push("atualizado_em = current_timestamp()", "atualizado_por = ?");
  params.push(userEmail, id);
  await query(`UPDATE ${T} SET ${sets.join(", ")} WHERE id = ?`, params);
}

export async function softDeleteFrota(id: number, userEmail: string): Promise<void> {
  await query(
    `UPDATE ${T} SET ativo = FALSE, atualizado_em = current_timestamp(), atualizado_por = ? WHERE id = ?`,
    [userEmail, id]
  );
}
```

- [ ] **Step 2: Smoke test write**

Criar `scripts/smoke-write.ts`:

```ts
import "dotenv/config";
import { createFrota, updateFrota, softDeleteFrota, getFrota } from "../lib/repos/frotas";
import { listHistorico } from "../lib/repos/historico";

(async () => {
  const id = await createFrota({ chassi: "TEST-CHASSI-XYZ-001", modelo: "TEST", placa: "TST-0001", km_atual: 1000 }, "smoke@bemol.com.br");
  console.log("Created id:", id);

  await updateFrota(id, { km_atual: 5000, observacoes: "trocou pneu" }, "smoke@bemol.com.br");
  const updated = await getFrota(id);
  console.log("Updated:", { km: updated?.km_atual, obs: updated?.observacoes });

  const hist = await listHistorico(id);
  console.log("História:", hist);

  await softDeleteFrota(id, "smoke@bemol.com.br");
  const deleted = await getFrota(id);
  console.log("After delete ativo=", deleted?.ativo);

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
```

```bash
npx tsx scripts/smoke-write.ts
```

Expected: cria registro, faz update (gera 2 entradas no histórico), soft delete põe `ativo=false`.

- [ ] **Step 3: Limpar registro de teste**

```bash
npx tsx -e "import('dotenv').then(d=>d.config()); import('./lib/db').then(async ({execute})=>{ await execute(\"DELETE FROM manutencao.cd.frotas_historico WHERE alterado_por='smoke@bemol.com.br'\"); await execute(\"DELETE FROM manutencao.cd.frotas WHERE chassi='TEST-CHASSI-XYZ-001'\"); console.log('cleaned'); })"
```

- [ ] **Step 4: Apagar smoke script**

```bash
rm scripts/smoke-write.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/repos/frotas.ts
git commit -m "feat: add write repos with history tracking and soft delete"
```

---

## Phase 4 — Read UI

### Task 10: App shell (sidebar nav, header)

**Files:**
- Create: `app/(app)/layout.tsx`, `components/app-shell.tsx`
- Create: `components/user-menu.tsx`

- [ ] **Step 1: Criar `components/user-menu.tsx`**

```tsx
"use client";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function UserMenu({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">{email}</span>
      <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Criar `components/app-shell.tsx`**

```tsx
import Link from "next/link";
import { Truck, LayoutDashboard, List, ShoppingCart } from "lucide-react";
import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/frotas", label: "Frotas", icon: List },
  { href: "/frotas/vendidos", label: "Vendidos", icon: ShoppingCart },
];

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr]">
      <aside className="bg-primary text-primary-foreground p-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Truck className="h-6 w-6" /> Frotas Bemol
        </div>
        <nav className="mt-8 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-white/10"
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-col">
        <header className="flex h-14 items-center justify-end border-b px-6">
          <UserMenu email={email} />
        </header>
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `app/(app)/layout.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  return <AppShell email={session.user.email}>{children}</AppShell>;
}
```

- [ ] **Step 4: Mover `app/page.tsx` (placeholder) para dentro de `(app)/`**

Mover `app/page.tsx` para `app/(app)/page.tsx`:

```tsx
export default function DashboardPage() {
  return <h1 className="text-3xl font-semibold">Dashboard</h1>;
}
```

- [ ] **Step 5: Adicionar dependência `next-auth/react` no client menu**

Já vem com `next-auth`. Se faltar:

```bash
npm i next-auth@5.0.0-beta.25
```

(já instalado)

- [ ] **Step 6: Verificar dev**

```bash
npm run dev
```

Login → deve aparecer sidebar azul com nav + e-mail + botão sair.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add authenticated app shell with sidebar nav"
```

---

### Task 11: Dashboard page

**Files:**
- Create: `components/dashboard/kpi-cards.tsx`, `components/dashboard/status-donut.tsx`
- Modify: `app/(app)/page.tsx`

- [ ] **Step 1: Criar `components/dashboard/kpi-cards.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Kpis } from "@/lib/repos/frotas";
import { formatNumber } from "@/lib/utils";

export function KpiCards({ kpis }: { kpis: Kpis }) {
  const items = [
    { label: "Total ativas", value: kpis.total_ativos, tone: "default" as const },
    { label: "Em manutenção", value: kpis.total_manutencao, tone: "warning" as const },
    { label: "Atenção", value: kpis.total_atencao, tone: "warning" as const },
    { label: "Crítico", value: kpis.total_critico, tone: "danger" as const },
    { label: "Idade média", value: kpis.idade_media != null ? `${kpis.idade_media.toFixed(1)} anos` : "—" },
    { label: "Km médio", value: kpis.km_medio != null ? formatNumber(Math.round(kpis.km_medio)) : "—" },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <Card key={it.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{it.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{typeof it.value === "number" ? formatNumber(it.value) : it.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Criar `components/dashboard/status-donut.tsx`**

```tsx
"use client";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = {
  disponivel: "hsl(158 64% 40%)",
  manutencao: "hsl(38 92% 50%)",
  atencao: "hsl(28 92% 55%)",
  critico: "hsl(0 84% 60%)",
};

export function StatusDonut({ data }: { data: { status: string; total: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status da frota</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="status" cx="50%" cy="50%" innerRadius={70} outerRadius={110}>
              {data.map((d) => (
                <Cell key={d.status} fill={COLORS[d.status as keyof typeof COLORS] || "hsl(215 16% 47%)"} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Adicionar query agregada por status em `lib/repos/frotas.ts`**

Ao final:

```ts
export async function statusBreakdown(): Promise<{ status: string; total: number }[]> {
  const r = await query<{ status: string; total: number }>(
    `SELECT status, COUNT(*) AS total FROM ${T} WHERE ativo AND NOT vendido GROUP BY status ORDER BY status`
  );
  return r.map((x) => ({ status: x.status, total: Number(x.total) }));
}
```

- [ ] **Step 4: Substituir `app/(app)/page.tsx`**

```tsx
import { kpis, statusBreakdown } from "@/lib/repos/frotas";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { StatusDonut } from "@/components/dashboard/status-donut";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [k, breakdown] = await Promise.all([kpis(), statusBreakdown()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Disponibilidade de Frotas</h1>
        <p className="text-sm text-muted-foreground">Visão analítica da frota Bemol.</p>
      </div>
      <KpiCards kpis={k} />
      <div className="grid gap-6 lg:grid-cols-2">
        <StatusDonut data={breakdown} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar no browser**

```bash
npm run dev
```

Abrir `http://localhost:3000/` (logado) → deve mostrar 6 cards de KPI + donut chart com status agrupados.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add dashboard with KPI cards and status donut chart"
```

---

### Task 12: Lista de frotas (`/frotas`)

**Files:**
- Create: `components/frotas/frotas-table.tsx`, `components/frotas/frotas-filters.tsx`
- Create: `app/(app)/frotas/page.tsx`

- [ ] **Step 1: Criar `components/frotas/frotas-filters.tsx`**

```tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Props = { modelos: string[]; localizacoes: string[] };

const STATUSES = [
  { value: "all", label: "Todos os status" },
  { value: "disponivel", label: "Disponível" },
  { value: "manutencao", label: "Manutenção" },
  { value: "atencao", label: "Atenção" },
  { value: "critico", label: "Crítico" },
];

export function FrotasFilters({ modelos, localizacoes }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`/frotas?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder="Buscar placa, chassi, modelo..."
        defaultValue={sp.get("search") ?? ""}
        onKeyDown={(e) => e.key === "Enter" && update("search", (e.target as HTMLInputElement).value)}
        className="max-w-xs"
      />
      <Select value={sp.get("modelo") ?? "all"} onValueChange={(v) => update("modelo", v)}>
        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Modelo" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os modelos</SelectItem>
          {modelos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={sp.get("localizacao") ?? "all"} onValueChange={(v) => update("localizacao", v)}>
        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Localização" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas localizações</SelectItem>
          {localizacoes.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={sp.get("status") ?? "all"} onValueChange={(v) => update("status", v)}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="ghost" onClick={() => router.push("/frotas")}>Limpar</Button>
    </div>
  );
}
```

- [ ] **Step 2: Criar `components/frotas/frotas-table.tsx`**

```tsx
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import type { Frota } from "@/lib/repos/frotas";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  disponivel: "default",
  manutencao: "secondary",
  atencao: "secondary",
  critico: "destructive",
};

export function FrotasTable({ rows }: { rows: Frota[] }) {
  if (rows.length === 0) {
    return <div className="rounded-lg border p-8 text-center text-muted-foreground">Nenhuma frota encontrada.</div>;
  }
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Frota</TableHead>
            <TableHead>Placa</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead>Ano</TableHead>
            <TableHead>Localização</TableHead>
            <TableHead className="text-right">Km</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((f) => (
            <TableRow key={f.id} className="cursor-pointer hover:bg-muted/40">
              <TableCell><Link href={`/frotas/${f.id}`}>{f.frota_geral ?? "—"}</Link></TableCell>
              <TableCell><Link href={`/frotas/${f.id}`}>{f.placa ?? "—"}</Link></TableCell>
              <TableCell>{f.modelo ?? "—"}</TableCell>
              <TableCell>{f.ano_fabricacao ?? "—"}</TableCell>
              <TableCell>{f.localizacao ?? "—"}</TableCell>
              <TableCell className="text-right">{formatNumber(f.km_atual)}</TableCell>
              <TableCell>
                {f.status && <Badge variant={STATUS_VARIANT[f.status] ?? "outline"}>{f.status}</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Criar `app/(app)/frotas/page.tsx`**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Mail } from "lucide-react";
import { FrotasFilters } from "@/components/frotas/frotas-filters";
import { FrotasTable } from "@/components/frotas/frotas-table";
import { listFrotas, modelosDistintos, localizacoesDistintas } from "@/lib/repos/frotas";
import type { StatusFrota } from "@/lib/rules";

export const dynamic = "force-dynamic";

export default async function FrotasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = sp.page ? parseInt(sp.page) : 1;
  const filters = {
    search: sp.search,
    modelo: sp.modelo,
    localizacao: sp.localizacao,
    status: sp.status as StatusFrota | undefined,
    page,
    pageSize: 50,
  };
  const [{ rows, total }, modelos, locs] = await Promise.all([
    listFrotas(filters),
    modelosDistintos(),
    localizacoesDistintas(),
  ]);
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Frotas</h1>
          <p className="text-sm text-muted-foreground">{total} frota(s) ativa(s)</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/frotas/relatorio"><Mail className="mr-2 h-4 w-4" />Enviar relatório</Link></Button>
          <Button asChild><Link href="/frotas/novo"><Plus className="mr-2 h-4 w-4" />Nova frota</Link></Button>
        </div>
      </div>
      <FrotasFilters modelos={modelos} localizacoes={locs} />
      <FrotasTable rows={rows} />
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <Button key={p} variant={p === page ? "default" : "outline"} size="sm" asChild>
              <Link href={`/frotas?${new URLSearchParams({ ...sp, page: String(p) }).toString()}`}>{p}</Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar no browser**

```bash
npm run dev
```

`/frotas` deve mostrar tabela com paginação, filtros funcionando (selecionar modelo recarrega lista).

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add frotas list with search, filters and pagination"
```

---

### Task 13: Detalhe da frota (`/frotas/[id]`)

**Files:**
- Create: `app/(app)/frotas/[id]/page.tsx`
- Create: `components/frotas/frota-info.tsx`, `components/frotas/historico-timeline.tsx`, `components/frotas/km-evolution-chart.tsx`

- [ ] **Step 1: Criar `components/frotas/frota-info.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Frota } from "@/lib/repos/frotas";
import { calcularIdade } from "@/lib/rules";
import { formatNumber } from "@/lib/utils";

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="mt-1 text-sm font-medium">{value ?? "—"}</div>
  </div>
);

export function FrotaInfo({ frota }: { frota: Frota }) {
  const idade = calcularIdade(frota.ano_fabricacao);
  return (
    <Card>
      <CardContent className="grid gap-6 p-6 md:grid-cols-3">
        <Field label="Frota geral" value={frota.frota_geral} />
        <Field label="Placa" value={frota.placa} />
        <Field label="Status" value={frota.status && <Badge>{frota.status}</Badge>} />
        <Field label="Modelo / Marca" value={frota.modelo} />
        <Field label="Chassi" value={frota.chassi} />
        <Field label="Renavam" value={frota.renavam} />
        <Field label="Ano de fabricação" value={frota.ano_fabricacao} />
        <Field label="Idade" value={idade != null ? `${idade} ano(s)` : "—"} />
        <Field label="Localização" value={frota.localizacao} />
        <Field label="Km atual" value={formatNumber(frota.km_atual)} />
        <Field label="Última atualização" value={frota.atualizado_por ?? "—"} />
        <div className="md:col-span-3">
          <Field label="Observações" value={<p className="whitespace-pre-wrap">{frota.observacoes ?? "—"}</p>} />
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Criar `components/frotas/historico-timeline.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { HistoricoEntry } from "@/lib/repos/historico";

export function HistoricoTimeline({ entries }: { entries: HistoricoEntry[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Histórico de alterações</CardTitle></CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem alterações registradas.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((h) => (
              <li key={h.id} className="border-l-2 border-primary/30 pl-4">
                <div className="text-xs text-muted-foreground">
                  {formatDate(h.alterado_em)} • {h.alterado_por}
                </div>
                <div className="text-sm">
                  <strong>{h.campo}</strong>: {h.valor_antigo || "—"} → <strong>{h.valor_novo || "—"}</strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Criar `components/frotas/km-evolution-chart.tsx`**

```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KmEvolutionChart({ data }: { data: { date: string; km: number }[] }) {
  if (data.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Evolução da quilometragem</CardTitle></CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="km" stroke="hsl(var(--primary))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Criar `app/(app)/frotas/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Edit, Trash, Mail } from "lucide-react";
import { getFrota } from "@/lib/repos/frotas";
import { listHistorico, listHistoricoKm } from "@/lib/repos/historico";
import { FrotaInfo } from "@/components/frotas/frota-info";
import { HistoricoTimeline } from "@/components/frotas/historico-timeline";
import { KmEvolutionChart } from "@/components/frotas/km-evolution-chart";

export const dynamic = "force-dynamic";

export default async function FrotaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const frotaId = parseInt(id);
  if (Number.isNaN(frotaId)) notFound();
  const frota = await getFrota(frotaId);
  if (!frota) notFound();

  const [hist, kmHist] = await Promise.all([listHistorico(frotaId), listHistoricoKm(frotaId)]);
  const kmData = kmHist.map((k) => ({ date: new Date(k.alterado_em).toLocaleDateString("pt-BR"), km: Number(k.valor_novo) || 0 }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link href="/frotas"><ChevronLeft className="h-4 w-4" /></Link></Button>
          <h1 className="text-2xl font-semibold">{frota.placa ?? frota.chassi ?? `Frota #${frota.id}`}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href={`/frotas/${frota.id}/editar`}><Edit className="mr-2 h-4 w-4" />Editar</Link></Button>
          <Button asChild variant="outline"><Link href={`/frotas/${frota.id}/email`}><Mail className="mr-2 h-4 w-4" />Enviar e-mail</Link></Button>
          <Button asChild variant="destructive"><Link href={`/frotas/${frota.id}/excluir`}><Trash className="mr-2 h-4 w-4" />Excluir</Link></Button>
        </div>
      </div>
      <FrotaInfo frota={frota} />
      <KmEvolutionChart data={kmData} />
      <HistoricoTimeline entries={hist} />
    </div>
  );
}
```

- [ ] **Step 5: Verificar**

`npm run dev` → clicar numa frota da lista → deve mostrar todos os blocos.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add frota detail page with info blocks, history and km chart"
```

---

## Phase 5 — Mutations

### Task 14: Server Actions de mutação

**Files:**
- Create: `app/(app)/frotas/_actions.ts`

- [ ] **Step 1: Criar `app/(app)/frotas/_actions.ts`**

```ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createFrota, updateFrota, softDeleteFrota } from "@/lib/repos/frotas";

const StatusEnum = z.enum(["disponivel", "manutencao", "atencao", "critico", "vendido"]);

const FrotaSchema = z.object({
  frota_geral: z.string().trim().optional().nullable(),
  placa: z.string().trim().min(1).max(20).optional().nullable(),
  modelo: z.string().trim().min(1).max(100),
  chassi: z.string().trim().min(5).max(40),
  renavam: z.string().trim().optional().nullable(),
  ano_fabricacao: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  localizacao: z.string().trim().optional().nullable(),
  km_atual: z.coerce.number().int().min(0).optional().nullable(),
  status: StatusEnum.optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
});

async function requireUser(): Promise<string> {
  const s = await auth();
  if (!s?.user?.email) throw new Error("Não autenticado");
  return s.user.email;
}

export async function criarFrotaAction(formData: FormData) {
  const email = await requireUser();
  const obj: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) obj[k] = v === "" ? null : v;
  const parsed = FrotaSchema.parse(obj);
  const id = await createFrota(parsed, email);
  revalidatePath("/frotas");
  redirect(`/frotas/${id}`);
}

export async function editarFrotaAction(id: number, formData: FormData) {
  const email = await requireUser();
  const obj: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) obj[k] = v === "" ? null : v;
  const parsed = FrotaSchema.partial().parse(obj);
  await updateFrota(id, parsed, email);
  revalidatePath(`/frotas/${id}`);
  revalidatePath("/frotas");
  redirect(`/frotas/${id}`);
}

export async function excluirFrotaAction(id: number) {
  const email = await requireUser();
  await softDeleteFrota(id, email);
  revalidatePath("/frotas");
  redirect("/frotas");
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add server actions for frota CRUD with zod validation"
```

---

### Task 15: Form de cadastro/edição

**Files:**
- Create: `components/frotas/frota-form.tsx`, `app/(app)/frotas/novo/page.tsx`, `app/(app)/frotas/[id]/editar/page.tsx`

- [ ] **Step 1: Criar `components/frotas/frota-form.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Frota } from "@/lib/repos/frotas";

const STATUSES = ["disponivel", "manutencao", "atencao", "critico"] as const;

type Props = {
  initial?: Partial<Frota>;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
};

export function FrotaForm({ initial, action, submitLabel }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => startTransition(async () => {
        try { await action(fd); }
        catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
      })}
      className="grid max-w-3xl gap-4 md:grid-cols-2"
    >
      <Field label="Frota geral" name="frota_geral" defaultValue={initial?.frota_geral ?? ""} />
      <Field label="Placa" name="placa" defaultValue={initial?.placa ?? ""} />
      <Field label="Modelo / Marca *" name="modelo" required defaultValue={initial?.modelo ?? ""} />
      <Field label="Chassi *" name="chassi" required defaultValue={initial?.chassi ?? ""} disabled={!!initial?.id} />
      <Field label="Renavam" name="renavam" defaultValue={initial?.renavam ?? ""} />
      <Field label="Ano de fabricação" name="ano_fabricacao" type="number" defaultValue={initial?.ano_fabricacao ?? ""} />
      <Field label="Localização" name="localizacao" defaultValue={initial?.localizacao ?? ""} />
      <Field label="Km atual" name="km_atual" type="number" defaultValue={initial?.km_atual ?? ""} />

      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <Select name="status" defaultValue={initial?.status ?? "disponivel"}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="md:col-span-2 space-y-1.5">
        <Label htmlFor="observacoes">Observações</Label>
        <textarea
          name="observacoes"
          rows={4}
          defaultValue={initial?.observacoes ?? ""}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : submitLabel}</Button>
      </div>
    </form>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, name, ...rest } = props;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...rest} />
    </div>
  );
}
```

- [ ] **Step 2: Criar `app/(app)/frotas/novo/page.tsx`**

```tsx
import { criarFrotaAction } from "../_actions";
import { FrotaForm } from "@/components/frotas/frota-form";

export default function NovaFrotaPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Nova frota</h1>
      <FrotaForm action={criarFrotaAction} submitLabel="Cadastrar" />
    </div>
  );
}
```

- [ ] **Step 3: Criar `app/(app)/frotas/[id]/editar/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getFrota } from "@/lib/repos/frotas";
import { editarFrotaAction } from "../../_actions";
import { FrotaForm } from "@/components/frotas/frota-form";

export default async function EditarFrotaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const frotaId = parseInt(id);
  const frota = await getFrota(frotaId);
  if (!frota) notFound();

  const boundAction = editarFrotaAction.bind(null, frotaId);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Editar frota</h1>
      <FrotaForm initial={frota} action={boundAction} submitLabel="Salvar alterações" />
    </div>
  );
}
```

- [ ] **Step 4: Verificar fluxo**

`npm run dev` → /frotas/novo → preencher → cadastrar → cai no detalhe. Editar → mudar km → salvar → ver entrada no histórico.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add new and edit frota forms with server actions"
```

---

### Task 16: Excluir frota (confirmação)

**Files:**
- Create: `components/frotas/delete-frota-button.tsx`
- Modify: `app/(app)/frotas/[id]/page.tsx` (substituir Link "Excluir" pelo botão)

- [ ] **Step 1: Criar `components/frotas/delete-frota-button.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash } from "lucide-react";
import { toast } from "sonner";
import { excluirFrotaAction } from "@/app/(app)/frotas/_actions";

export function DeleteFrotaButton({ id, label }: { id: number; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive"><Trash className="mr-2 h-4 w-4" />Excluir</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir frota?</DialogTitle>
          <DialogDescription>
            A frota <strong>{label}</strong> será marcada como inativa e some da lista. Operação reversível pelo banco.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(async () => {
              try { await excluirFrotaAction(id); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
            })}
          >
            {pending ? "Excluindo..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Substituir o botão de excluir em `app/(app)/frotas/[id]/page.tsx`**

Localizar:
```tsx
<Button asChild variant="destructive"><Link href={`/frotas/${frota.id}/excluir`}><Trash className="mr-2 h-4 w-4" />Excluir</Link></Button>
```

Substituir por:
```tsx
<DeleteFrotaButton id={frota.id} label={frota.placa ?? frota.chassi ?? `#${frota.id}`} />
```

E adicionar ao topo:
```tsx
import { DeleteFrotaButton } from "@/components/frotas/delete-frota-button";
```

- [ ] **Step 3: Verificar**

`npm run dev` → detalhe → clicar Excluir → confirmar → frota some da lista padrão.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add delete confirmation dialog for frotas"
```

---

## Phase 6 — Email

### Task 17: Lib de e-mail (`lib/email.ts`)

**Files:**
- Create: `lib/email.ts`, `lib/email-templates.ts`

- [ ] **Step 1: Criar `lib/email-templates.ts`**

```ts
import type { Frota } from "@/lib/repos/frotas";
import { calcularIdade } from "@/lib/rules";

const HEADER = `
<div style="background:hsl(222,47%,25%);color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
  <div style="font-size:13px;opacity:.85">Sistema de Gestão de Frotas</div>
  <div style="font-size:22px;font-weight:600;margin-top:4px;">Frotas Bemol</div>
</div>`;

function row(label: string, value: string | number | null | undefined): string {
  return `<tr><td style="padding:6px 12px;color:#64748b;font-size:12px;">${label}</td><td style="padding:6px 12px;font-size:13px;font-weight:500;">${value ?? "—"}</td></tr>`;
}

export function renderRelatorioGeral(frotas: Frota[], dataRef: Date): string {
  const linhas = frotas.map((f) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${f.frota_geral ?? "—"}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${f.placa ?? "—"}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${f.modelo ?? "—"}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${f.localizacao ?? "—"}</td>
      <td style="padding:8px;text-align:right;border-bottom:1px solid #e2e8f0;">${f.km_atual?.toLocaleString("pt-BR") ?? "—"}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${f.status ?? "—"}</td>
    </tr>`).join("");

  return `
  <div style="font-family:Arial,sans-serif;max-width:880px;margin:0 auto;color:#0f172a;">
    ${HEADER}
    <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px;">
      <h2 style="margin:0 0 4px;font-size:18px;">Relatório geral de frotas</h2>
      <div style="font-size:12px;color:#64748b;margin-bottom:16px;">Data: ${dataRef.toLocaleDateString("pt-BR")} • ${frotas.length} frota(s)</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:hsl(222,47%,25%);color:#fff;">
          <th style="padding:8px;text-align:left;">Frota</th>
          <th style="padding:8px;text-align:left;">Placa</th>
          <th style="padding:8px;text-align:left;">Modelo</th>
          <th style="padding:8px;text-align:left;">Localização</th>
          <th style="padding:8px;text-align:right;">Km</th>
          <th style="padding:8px;text-align:left;">Status</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
  </div>`;
}

export function renderRelatorioIndividual(frota: Frota): string {
  const idade = calcularIdade(frota.ano_fabricacao);
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
    ${HEADER}
    <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px;">
      <h2 style="margin:0 0 4px;font-size:18px;">Detalhes da frota ${frota.placa ?? frota.frota_geral ?? frota.id}</h2>
      <div style="font-size:12px;color:#64748b;margin-bottom:16px;">${new Date().toLocaleDateString("pt-BR")}</div>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:6px;overflow:hidden;">
        <tbody>
          ${row("Frota geral", frota.frota_geral)}
          ${row("Placa", frota.placa)}
          ${row("Modelo / Marca", frota.modelo)}
          ${row("Chassi", frota.chassi)}
          ${row("Ano de fabricação", frota.ano_fabricacao)}
          ${row("Idade", idade != null ? `${idade} ano(s)` : "—")}
          ${row("Localização", frota.localizacao)}
          ${row("Km atual", frota.km_atual?.toLocaleString("pt-BR"))}
          ${row("Status", frota.status)}
        </tbody>
      </table>
      ${frota.observacoes ? `<div style="margin-top:16px;font-size:13px;"><strong>Observações:</strong><br>${frota.observacoes.replace(/\n/g, "<br>")}</div>` : ""}
    </div>
  </div>`;
}
```

- [ ] **Step 2: Criar `lib/email.ts`**

```ts
import "server-only";
import sg from "@sendgrid/mail";
import { logEmail } from "@/lib/repos/email-logs";
import { renderRelatorioGeral, renderRelatorioIndividual } from "@/lib/email-templates";
import type { Frota } from "@/lib/repos/frotas";

sg.setApiKey(process.env.SENDGRID_API_KEY!.trim());

const FROM = process.env.FROM_EMAIL || "ordensmanutencao@bemol.com.br";

type SendResult = { ok: true } | { ok: false; error: string };

export async function sendRelatorioGeral(args: {
  destinatarios: string[];
  frotas: Frota[];
  enviadoPor: string;
}): Promise<SendResult> {
  const assunto = `Relatório geral de frotas — ${new Date().toLocaleDateString("pt-BR")}`;
  const html = renderRelatorioGeral(args.frotas, new Date());
  try {
    await sg.send({ from: FROM, to: args.destinatarios, subject: assunto, html });
    await logEmail({ tipo: "geral", destinatarios: args.destinatarios.join(","), assunto, enviadoPor: args.enviadoPor, status: "enviado" });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logEmail({ tipo: "geral", destinatarios: args.destinatarios.join(","), assunto, enviadoPor: args.enviadoPor, status: "erro", erroMsg: msg });
    return { ok: false, error: msg };
  }
}

export async function sendRelatorioIndividual(args: {
  destinatarios: string[];
  frota: Frota;
  enviadoPor: string;
}): Promise<SendResult> {
  const assunto = `Frota ${args.frota.placa ?? args.frota.id} — relatório`;
  const html = renderRelatorioIndividual(args.frota);
  try {
    await sg.send({ from: FROM, to: args.destinatarios, subject: assunto, html });
    await logEmail({ tipo: "individual", frotaId: args.frota.id, destinatarios: args.destinatarios.join(","), assunto, enviadoPor: args.enviadoPor, status: "enviado" });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logEmail({ tipo: "individual", frotaId: args.frota.id, destinatarios: args.destinatarios.join(","), assunto, enviadoPor: args.enviadoPor, status: "erro", erroMsg: msg });
    return { ok: false, error: msg };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts lib/email-templates.ts
git commit -m "feat: add email send helpers and HTML templates for reports"
```

---

### Task 18: Diálogos de envio (server actions + UI)

**Files:**
- Modify: `app/(app)/frotas/_actions.ts` (adicionar 2 actions)
- Create: `components/relatorios/enviar-relatorio-dialog.tsx`
- Modify: `app/(app)/frotas/page.tsx` (botão "Enviar relatório" abre dialog)
- Modify: `app/(app)/frotas/[id]/page.tsx` (botão "Enviar e-mail" abre dialog)

- [ ] **Step 1: Adicionar actions em `app/(app)/frotas/_actions.ts`**

Anexar:

```ts
import { listFrotas, getFrota } from "@/lib/repos/frotas";
import { sendRelatorioGeral, sendRelatorioIndividual } from "@/lib/email";

const EmailListSchema = z.string().refine((s) => s.split(",").map((x) => x.trim()).every((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)), {
  message: "E-mails inválidos",
});

export async function enviarRelatorioGeralAction(formData: FormData) {
  const email = await requireUser();
  const dest = EmailListSchema.parse(formData.get("destinatarios"));
  const destinatarios = dest.split(",").map((s) => s.trim());
  const { rows } = await listFrotas({ pageSize: 1000 });
  const r = await sendRelatorioGeral({ destinatarios, frotas: rows, enviadoPor: email });
  if (!r.ok) throw new Error(r.error);
}

export async function enviarRelatorioIndividualAction(frotaId: number, formData: FormData) {
  const email = await requireUser();
  const dest = EmailListSchema.parse(formData.get("destinatarios"));
  const destinatarios = dest.split(",").map((s) => s.trim());
  const frota = await getFrota(frotaId);
  if (!frota) throw new Error("Frota não encontrada");
  const r = await sendRelatorioIndividual({ destinatarios, frota, enviadoPor: email });
  if (!r.ok) throw new Error(r.error);
}
```

- [ ] **Step 2: Criar `components/relatorios/enviar-relatorio-dialog.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";
import { toast } from "sonner";

type Props = {
  trigger: React.ReactNode;
  title: string;
  action: (formData: FormData) => Promise<void>;
};

export function EnviarRelatorioDialog({ trigger, title, action }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form
          action={(fd) => startTransition(async () => {
            try {
              await action(fd);
              toast.success("Relatório enviado!");
              setOpen(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Erro ao enviar");
            }
          })}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="destinatarios">Destinatários (e-mails separados por vírgula)</Label>
            <Input id="destinatarios" name="destinatarios" placeholder="ana@bemol.com.br, joao@fornecedor.com" required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando..." : <><Mail className="mr-2 h-4 w-4" />Enviar</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Trocar botão "Enviar relatório" em `app/(app)/frotas/page.tsx`**

Substituir:
```tsx
<Button asChild variant="outline"><Link href="/frotas/relatorio"><Mail className="mr-2 h-4 w-4" />Enviar relatório</Link></Button>
```

Por:
```tsx
<EnviarRelatorioDialog
  title="Enviar relatório geral"
  action={enviarRelatorioGeralAction}
  trigger={<Button variant="outline"><Mail className="mr-2 h-4 w-4" />Enviar relatório</Button>}
/>
```

E adicionar imports:
```tsx
import { EnviarRelatorioDialog } from "@/components/relatorios/enviar-relatorio-dialog";
import { enviarRelatorioGeralAction } from "./_actions";
```

- [ ] **Step 4: Trocar botão "Enviar e-mail" em `app/(app)/frotas/[id]/page.tsx`**

Substituir:
```tsx
<Button asChild variant="outline"><Link href={`/frotas/${frota.id}/email`}><Mail className="mr-2 h-4 w-4" />Enviar e-mail</Link></Button>
```

Por:
```tsx
<EnviarRelatorioDialog
  title={`Enviar relatório de ${frota.placa ?? frota.id}`}
  action={enviarRelatorioIndividualAction.bind(null, frota.id)}
  trigger={<Button variant="outline"><Mail className="mr-2 h-4 w-4" />Enviar e-mail</Button>}
/>
```

E adicionar imports:
```tsx
import { EnviarRelatorioDialog } from "@/components/relatorios/enviar-relatorio-dialog";
import { enviarRelatorioIndividualAction } from "../_actions";
```

- [ ] **Step 5: Verificar**

`npm run dev` → enviar relatório geral pra você mesmo (`gustavoandrade@bemol.com.br`) → conferir caixa de entrada.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add email report dialogs (general + individual) wired to SendGrid"
```

---

## Phase 7 — Vendidos & Polish

### Task 19: Aba Vendidos

**Files:**
- Create: `app/(app)/frotas/vendidos/page.tsx`

- [ ] **Step 1: Criar `app/(app)/frotas/vendidos/page.tsx`**

```tsx
import { listFrotas } from "@/lib/repos/frotas";
import { FrotasTable } from "@/components/frotas/frotas-table";

export const dynamic = "force-dynamic";

export default async function VendidosPage() {
  const { rows, total } = await listFrotas({ vendidos: true, pageSize: 1000 });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Frotas vendidas</h1>
        <p className="text-sm text-muted-foreground">{total} frota(s) marcada(s) como vendidas</p>
      </div>
      <FrotasTable rows={rows} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add vendidos page (read-only list of sold frotas)"
```

---

### Task 20: Loading states + tratamento de erro

**Files:**
- Create: `app/(app)/loading.tsx`, `app/(app)/error.tsx`, `app/(app)/frotas/loading.tsx`

- [ ] **Step 1: Criar `app/(app)/loading.tsx`**

```tsx
export default function Loading() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        Carregando…
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar `app/(app)/error.tsx`**

```tsx
"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid place-items-center p-12">
      <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <h2 className="text-lg font-semibold text-destructive">Algo deu errado</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={reset} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `app/(app)/frotas/loading.tsx`** (skeleton da tabela)

```tsx
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-12 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted/60" />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add loading and error UI states"
```

---

### Task 21: Deploy na Vercel

**Files:**
- Create: `vercel.ts`
- Modify: `.env` (`NEXTAUTH_URL` para o domínio de produção)

- [ ] **Step 1: Criar `vercel.ts`**

```ts
import { type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "next build",
  installCommand: "npm install",
};

export default config;
```

- [ ] **Step 2: Push pro remote (criar repo se não existir)**

> Se ainda não tem remote: criar repo privado no GitHub Bemol/pessoal e linkar.
> ```bash
> git remote add origin git@github.com:<owner>/frotas-bemol.git
> git push -u origin main
> ```

- [ ] **Step 3: Importar no Vercel**

Manual no dashboard Vercel:
1. New Project → Import Git Repository
2. Configurar env vars (cópia do `.env`, exceto `NEXTAUTH_URL` que será a URL da Vercel)
3. Deploy

- [ ] **Step 4: Atualizar `NEXTAUTH_URL` e Entra ID redirect URI**

Quando souber a URL definitiva (ex: `https://frotas.vercel.app`):
- Adicionar `NEXTAUTH_URL=https://frotas.vercel.app` no Vercel
- Adicionar redirect URI no Azure: `https://frotas.vercel.app/api/auth/callback/microsoft-entra-id`

- [ ] **Step 5: Validar deploy**

Acessar URL → fazer login → dashboard carrega → enviar e-mail teste.

- [ ] **Step 6: Commit final**

```bash
git add vercel.ts
git commit -m "chore: add vercel.ts production config"
git push
```

---

## Verificação contra critérios de aceite

Antes de declarar pronto, validar manualmente os 10 critérios da Seção 13 do spec:

- [ ] Login Bemol funciona e bloqueia e-mails externos
- [ ] Schema `manutencao.cd` criado com as 3 tabelas (`SHOW TABLES IN manutencao.cd`)
- [ ] Import da planilha popula todas as frotas válidas, sem duplicar (rodar 2x)
- [ ] Dashboard mostra KPIs e donut chart com números coerentes
- [ ] Lista permite buscar/filtrar/paginar e abrir detalhe
- [ ] Edição grava histórico ao mudar km/status/observacoes/localizacao (verificar tabela `frotas_historico`)
- [ ] Enviar relatório geral por e-mail funciona
- [ ] Enviar relatório individual funciona
- [ ] `/frotas/vendidos` mostra os ~8 vendidos
- [ ] Soft delete remove da lista padrão (e a flag `ativo=false` no banco)
- [ ] Deploy Vercel acessível via URL pública

---

## Notas e gotchas

1. **Latência Databricks:** primeira request após auto-stop do warehouse pode levar 30s. Os `loading.tsx` cobrem isso. Se virar problema, considerar bumping `keepalive` do warehouse via console Databricks.
2. **`@databricks/sql` no bundle:** já está em `serverExternalPackages`. Se o build da Vercel reclamar, tentar adicionar também em `webpack.externals` no `next.config.ts`.
3. **`FILTER (WHERE ...)`:** suportado no Databricks SQL Photon. Se rodar warehouse classic e falhar, substituir por `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` em `kpis()`.
4. **Microsoft Entra ID — primeira vez:** se nunca foi feito o consent admin no tenant Bemol, o TI precisa aprovar permissions `User.Read` + `email` + `openid` + `profile`.
5. **SendGrid `FROM` verificado:** `ordensmanutencao@bemol.com.br` precisa estar autenticado no SendGrid (Single Sender ou domínio). Caso contrário, e-mails caem em quarentena ou são rejeitados.
6. **Identity columns no Delta:** `MAX(id) WHERE chassi = ?` logo após INSERT (Task 9, Step 1) pode ter race condition em escritas concorrentes. Aceitável aqui (poucos usuários). Se virar problema, trocar para INSERT com retorno explícito ou UUID gerado pelo cliente.
