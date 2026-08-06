# Relatório Operacional Diário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send an automated daily email (7am Manaus time) summarizing checklist compliance for the previous day — checklists completed, pendências (apontamentos) opened, which active fleets did/didn't check in, and the day's pendências grouped by fleet.

**Architecture:** Reuse the existing `email_schedules` admin-configurable recipient system and SendGrid send pipeline. Add a new schedule type `RELATORIO_OPERACIONAL_DIARIO`, a sibling API route to the existing `/api/relatorios/daily`, three new data-fetching functions in `lib/repos/relatorios.ts` (with their set-difference/grouping logic extracted into pure, unit-tested helpers), a new render function in the shared `lib/email-templates.ts` design system, and a new GitHub Actions cron workflow that POSTs to the route daily.

**Tech Stack:** Next.js App Router route handlers, Supabase (`@supabase/supabase-js`, no ORM), SendGrid (`@sendgrid/mail`), Vitest for unit tests, GitHub Actions for cron scheduling.

## Global Constraints

- Report window: previous full calendar day in `America/Manaus` timezone (`reportCalendarDate()` / `reportDayUtcRange()` from `lib/report-date.ts`), sent at 7am Manaus (`11:00 UTC`, no DST).
- "Apontamentos" = pendências (`pendencias_frota`) **created** during the report's day — not the full open backlog.
- "Frotas que não fizeram" = every fleet with `ativo=true, vendido=false` (via `listFrotasForReport()`), regardless of any planned trip/route.
- Recipients are configured through the existing `/administracao/emails` admin UI (`email_schedules` table), never hardcoded.
- The email HTML must use the shared design system in `lib/email-templates.ts` (`shell()`, `header()`, `summaryCell()`, `badge()`, palette `BLUE`/`BLUE_2`/`INK`/`MUTED`/`BORDER`/`SURFACE`) — not the ad-hoc inline CSS style used by `app/api/relatorios/daily/route.ts`.
- Single consolidated report — one email covering all fleets, not one email per fleet.
- Internal endpoint auth via `isInternalAuthorized()` (`x-internal-secret` header against `FROTAS_INTERNAL_SECRET`), same as all other internal report endpoints.

---

### Task 1: Allow the new schedule type in the database

**Files:**
- Create: `supabase/migrations/20260806120000_relatorio_operacional_diario.sql`

**Interfaces:**
- Produces: `email_schedules.tipo` accepts the value `'RELATORIO_OPERACIONAL_DIARIO'` (and, as a drift fix, `'RELATORIO_DIARIO_IA'`, which the app already writes via `_actions.ts` but which is missing from the original `email_schedules_tipo_check` constraint defined in migration 015).

- [ ] **Step 1: Write the migration**

```sql
-- Migration: adiciona tipo RELATORIO_OPERACIONAL_DIARIO ao email_schedules.
-- Tambem inclui RELATORIO_DIARIO_IA, que ja e aceito pela aplicacao
-- (app/(app)/administracao/emails/_actions.ts) mas nunca foi adicionado
-- ao CHECK constraint original da migration 015 — corrige o drift.

alter table public.email_schedules
  drop constraint if exists email_schedules_tipo_check;

alter table public.email_schedules
  add constraint email_schedules_tipo_check check (tipo in (
    'DISPONIBILIDADE','PREVENTIVAS_ATRASO','LAVAGEM_PENDENTE',
    'TACOGRAFO_VENCIDO','FROTAS_PARADAS','CUSTOS','ALERTAS',
    'RELATORIO_DIARIO_IA','RELATORIO_OPERACIONAL_DIARIO'
  ));
```

- [ ] **Step 2: Apply the migration to the local/dev Supabase project**

Run: `supabase db push` (or the project's established migration-apply command — check `supabase/migrations/` for a `README` or check how the last migration was applied if `supabase db push` isn't configured for this project).

Expected: command reports the new migration applied with no errors.

- [ ] **Step 3: Verify the constraint accepts the new value**

Run a manual insert/rollback check via the Supabase SQL editor or `psql`:

```sql
begin;
insert into public.email_schedules (nome, tipo, destinatarios, frequencia, hora_envio)
values ('teste', 'RELATORIO_OPERACIONAL_DIARIO', '{teste@example.com}', 'DIARIO', '07:00');
rollback;
```

Expected: insert succeeds (no CHECK violation), then rollback discards it.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260806120000_relatorio_operacional_diario.sql
git commit -m "feat(db): allow RELATORIO_OPERACIONAL_DIARIO email schedule type"
```

---

### Task 2: Pure helpers for fleet compliance and pendência grouping

**Files:**
- Modify: `lib/repos/relatorios.ts`
- Test: `lib/repos/relatorios.test.ts` (new)

**Interfaces:**
- Produces:
  - `export type FrotaResumoChecklist = { frota_id: number; frota_geral: string | null; placa: string | null }`
  - `export function splitFrotasPorChecklist(frotasAtivas: { id: number; frota_geral: string | null; placa: string | null }[], frotaIdsComChecklist: number[]): { fizeram: FrotaResumoChecklist[]; naoFizeram: FrotaResumoChecklist[] }`
  - `export type PendenciaComFrota = { frota_id: number; frota_geral: string | null; placa: string | null; item_nome: string; gravidade: string }`
  - `export type PendenciaGrupoFrota = { frota_id: number; frota_geral: string | null; placa: string | null; itens: { item_nome: string; gravidade: string }[] }`
  - `export function agruparPendenciasPorFrota(pendencias: PendenciaComFrota[]): PendenciaGrupoFrota[]`

Both functions are pure (no I/O) so they can be unit tested without touching Supabase — this codebase has no pattern for mocking `supabaseManutencao` in tests (see `lib/frota-derived.test.ts`, `lib/checklists/vehicle-search.test.ts` — both test pure functions only), so the DB-touching wrapper functions built in Task 3 are deliberately left without unit tests, consistent with existing repo test coverage.

- [ ] **Step 1: Write the failing tests**

Create `lib/repos/relatorios.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { agruparPendenciasPorFrota, splitFrotasPorChecklist } from "@/lib/repos/relatorios";

describe("splitFrotasPorChecklist", () => {
  it("separates active fleets into fizeram/naoFizeram based on checklist frota ids", () => {
    const frotasAtivas = [
      { id: 1, frota_geral: "10", placa: "AAA-0001" },
      { id: 2, frota_geral: "20", placa: "BBB-0002" },
      { id: 3, frota_geral: "5", placa: "CCC-0003" },
    ];

    const result = splitFrotasPorChecklist(frotasAtivas, [2, 2, 3]);

    expect(result.fizeram.map((f) => f.frota_id)).toEqual([3, 2]);
    expect(result.naoFizeram.map((f) => f.frota_id)).toEqual([1]);
  });

  it("sorts each group alphabetically by frota_geral, falling back to placa then id", () => {
    const frotasAtivas = [
      { id: 1, frota_geral: null, placa: "ZZZ-0001" },
      { id: 2, frota_geral: "B", placa: null },
      { id: 3, frota_geral: "A", placa: null },
    ];

    const result = splitFrotasPorChecklist(frotasAtivas, []);

    expect(result.naoFizeram.map((f) => f.frota_id)).toEqual([3, 2, 1]);
  });

  it("returns fizeram empty when no checklist ids match", () => {
    const frotasAtivas = [{ id: 1, frota_geral: "1", placa: null }];

    const result = splitFrotasPorChecklist(frotasAtivas, []);

    expect(result.fizeram).toEqual([]);
    expect(result.naoFizeram).toHaveLength(1);
  });
});

describe("agruparPendenciasPorFrota", () => {
  it("groups pendencias by frota_id preserving item order", () => {
    const pendencias = [
      { frota_id: 1, frota_geral: "10", placa: "AAA-0001", item_nome: "Pneu", gravidade: "ALTA" },
      { frota_id: 1, frota_geral: "10", placa: "AAA-0001", item_nome: "Farol", gravidade: "BAIXA" },
      { frota_id: 2, frota_geral: "5", placa: "BBB-0002", item_nome: "Freio", gravidade: "CRITICA" },
    ];

    const result = agruparPendenciasPorFrota(pendencias);

    expect(result).toHaveLength(2);
    expect(result[0].frota_id).toBe(2);
    expect(result[0].itens).toEqual([{ item_nome: "Freio", gravidade: "CRITICA" }]);
    expect(result[1].frota_id).toBe(1);
    expect(result[1].itens).toEqual([
      { item_nome: "Pneu", gravidade: "ALTA" },
      { item_nome: "Farol", gravidade: "BAIXA" },
    ]);
  });

  it("returns an empty array for no pendencias", () => {
    expect(agruparPendenciasPorFrota([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/repos/relatorios.test.ts`
Expected: FAIL — `splitFrotasPorChecklist` and `agruparPendenciasPorFrota` are not exported from `lib/repos/relatorios.ts`.

- [ ] **Step 3: Implement the pure helpers**

Add to `lib/repos/relatorios.ts` (near the top, after the existing type exports, before `getRelatorioKpis`):

```typescript
export type FrotaResumoChecklist = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
};

function frotaSortKey(f: { frota_geral: string | null; placa: string | null; frota_id: number }): string {
  return f.frota_geral ?? f.placa ?? String(f.frota_id);
}

export function splitFrotasPorChecklist(
  frotasAtivas: { id: number; frota_geral: string | null; placa: string | null }[],
  frotaIdsComChecklist: number[]
): { fizeram: FrotaResumoChecklist[]; naoFizeram: FrotaResumoChecklist[] } {
  const comChecklist = new Set(frotaIdsComChecklist);
  const fizeram: FrotaResumoChecklist[] = [];
  const naoFizeram: FrotaResumoChecklist[] = [];

  for (const frota of frotasAtivas) {
    const resumo: FrotaResumoChecklist = {
      frota_id: frota.id,
      frota_geral: frota.frota_geral,
      placa: frota.placa,
    };
    if (comChecklist.has(frota.id)) fizeram.push(resumo);
    else naoFizeram.push(resumo);
  }

  const bySortKey = (a: FrotaResumoChecklist, b: FrotaResumoChecklist) =>
    frotaSortKey(a).localeCompare(frotaSortKey(b));

  return { fizeram: fizeram.sort(bySortKey), naoFizeram: naoFizeram.sort(bySortKey) };
}

export type PendenciaComFrota = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  item_nome: string;
  gravidade: string;
};

export type PendenciaGrupoFrota = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  itens: { item_nome: string; gravidade: string }[];
};

export function agruparPendenciasPorFrota(pendencias: PendenciaComFrota[]): PendenciaGrupoFrota[] {
  const map = new Map<number, PendenciaGrupoFrota>();

  for (const p of pendencias) {
    const existing = map.get(p.frota_id);
    if (existing) {
      existing.itens.push({ item_nome: p.item_nome, gravidade: p.gravidade });
    } else {
      map.set(p.frota_id, {
        frota_id: p.frota_id,
        frota_geral: p.frota_geral,
        placa: p.placa,
        itens: [{ item_nome: p.item_nome, gravidade: p.gravidade }],
      });
    }
  }

  return [...map.values()].sort((a, b) => frotaSortKey(a).localeCompare(frotaSortKey(b)));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/repos/relatorios.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/repos/relatorios.ts lib/repos/relatorios.test.ts
git commit -m "feat(relatorios): add pure helpers for fleet checklist split and pendencia grouping"
```

---

### Task 3: Data-fetching functions wired to Supabase

**Files:**
- Modify: `lib/repos/relatorios.ts`

**Interfaces:**
- Consumes: `splitFrotasPorChecklist`, `agruparPendenciasPorFrota`, `FrotaResumoChecklist`, `PendenciaComFrota`, `PendenciaGrupoFrota` (Task 2, same file); `reportDayUtcRange` from `lib/report-date.ts` (already imported in this file); `listFrotasForReport` from `@/lib/repos/frotas` (new import — returns `Frota[]` with fields `id`, `frota_geral`, `placa`, already filtered to `ativo=true, vendido=false`).
- Produces:
  - `export async function getChecklistsRealizadosNoDia(date: string): Promise<number>`
  - `export async function getFrotasComSemChecklistNoDia(date: string): Promise<{ fizeram: FrotaResumoChecklist[]; naoFizeram: FrotaResumoChecklist[] }>`
  - `export async function getPendenciasCriadasNoDiaPorFrota(date: string): Promise<PendenciaGrupoFrota[]>`

- [ ] **Step 1: Add the import**

At the top of `lib/repos/relatorios.ts`, add:

```typescript
import { listFrotasForReport } from "@/lib/repos/frotas";
```

- [ ] **Step 2: Implement the three functions**

Add to `lib/repos/relatorios.ts`, after `getEvolucao7Dias`:

```typescript
export async function getChecklistsRealizadosNoDia(date: string): Promise<number> {
  const { start, end } = reportDayUtcRange(date);

  const { count, error } = await supabaseManutencao
    .from("checklists_frota")
    .select("id", { count: "exact", head: true })
    .gte("data_checklist", start)
    .lt("data_checklist", end);

  if (error) throw new Error(`getChecklistsRealizadosNoDia: ${error.message}`);
  return count ?? 0;
}

export async function getFrotasComSemChecklistNoDia(
  date: string
): Promise<{ fizeram: FrotaResumoChecklist[]; naoFizeram: FrotaResumoChecklist[] }> {
  const { start, end } = reportDayUtcRange(date);

  const [frotasAtivas, checklistRows] = await Promise.all([
    listFrotasForReport(),
    supabaseManutencao
      .from("checklists_frota")
      .select("frota_id")
      .gte("data_checklist", start)
      .lt("data_checklist", end),
  ]);

  if (checklistRows.error) {
    throw new Error(`getFrotasComSemChecklistNoDia: ${checklistRows.error.message}`);
  }

  const frotaIdsComChecklist = (checklistRows.data ?? []).map((r) =>
    Number((r as { frota_id: number }).frota_id)
  );

  return splitFrotasPorChecklist(
    frotasAtivas.map((f) => ({ id: f.id, frota_geral: f.frota_geral, placa: f.placa })),
    frotaIdsComChecklist
  );
}

export async function getPendenciasCriadasNoDiaPorFrota(date: string): Promise<PendenciaGrupoFrota[]> {
  const { start, end } = reportDayUtcRange(date);

  const { data, error } = await supabaseManutencao
    .from("pendencias_frota")
    .select("frota_id,item_nome,gravidade,criado_em")
    .gte("criado_em", start)
    .lt("criado_em", end);

  if (error) throw new Error(`getPendenciasCriadasNoDiaPorFrota: ${error.message}`);

  const rows = (data ?? []) as { frota_id: number; item_nome: string; gravidade: string }[];
  const frotaIds = [...new Set(rows.map((r) => r.frota_id))];
  if (frotaIds.length === 0) return [];

  const { data: veiculos, error: veiculosError } = await supabaseManutencao
    .from("veiculos")
    .select("id,codigo_frota,placa")
    .in("id", frotaIds);
  if (veiculosError) throw new Error(`getPendenciasCriadasNoDiaPorFrota veiculos: ${veiculosError.message}`);

  const veiculoMap = new Map(
    (veiculos ?? []).map((v) => [Number(v.id), v as { id: number; codigo_frota: string | null; placa: string | null }])
  );

  const pendenciasComFrota: PendenciaComFrota[] = rows.map((r) => ({
    frota_id: r.frota_id,
    frota_geral: veiculoMap.get(r.frota_id)?.codigo_frota ?? null,
    placa: veiculoMap.get(r.frota_id)?.placa ?? null,
    item_nome: r.item_nome,
    gravidade: r.gravidade,
  }));

  return agruparPendenciasPorFrota(pendenciasComFrota);
}
```

- [ ] **Step 3: Type-check the file**

Run: `npx tsc --noEmit`
Expected: no new errors in `lib/repos/relatorios.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/repos/relatorios.ts
git commit -m "feat(relatorios): add checklist count, fleet compliance and pendencia queries for the operational report"
```

---

### Task 4: Email template using the shared design system

**Files:**
- Modify: `lib/email-templates.ts`

**Interfaces:**
- Consumes: `shell`, `header`, `summaryCell`, `badge`, `display`, `formatNumber`, `percent`, `escapeHtml`, `formatReportDate`, constants `BLUE`, `INK`, `MUTED`, `BORDER` (all already defined in this file); `ReportOptions` type (already defined in this file).
- Produces:
  - `export type RelatorioOperacionalDiarioInput = { totalChecklists: number; totalApontamentos: number; frotasFizeram: { frota_id: number; frota_geral: string | null; placa: string | null }[]; frotasNaoFizeram: { frota_id: number; frota_geral: string | null; placa: string | null }[]; pendenciasPorFrota: { frota_id: number; frota_geral: string | null; placa: string | null; itens: { item_nome: string; gravidade: string }[] }[] }`
  - `export function renderRelatorioOperacionalDiario(input: RelatorioOperacionalDiarioInput, dataRef: Date, options?: ReportOptions): string`

- [ ] **Step 1: Add the type and render function**

Add to `lib/email-templates.ts`, after `renderRelatorioIndividual` (before the `SocorroNotificationInput` type):

```typescript
export type RelatorioOperacionalDiarioInput = {
  totalChecklists: number;
  totalApontamentos: number;
  frotasFizeram: { frota_id: number; frota_geral: string | null; placa: string | null }[];
  frotasNaoFizeram: { frota_id: number; frota_geral: string | null; placa: string | null }[];
  pendenciasPorFrota: {
    frota_id: number;
    frota_geral: string | null;
    placa: string | null;
    itens: { item_nome: string; gravidade: string }[];
  }[];
};

function pendenciaGravidadeTone(gravidade: string): { bg: string; color: string; border: string } {
  const g = gravidade.toUpperCase();
  if (g === "CRITICA") return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
  if (g === "ALTA") return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
  return { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" };
}

function frotasChecklistTable(
  titulo: string,
  frotas: { frota_id: number; frota_geral: string | null; placa: string | null }[],
  vazioMsg: string
): string {
  const linhas = frotas
    .map((f, index) => {
      const bg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background:${bg};">
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:${INK};">${display(f.frota_geral ?? f.frota_id)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${display(f.placa)}</td>
      </tr>`;
    })
    .join("");
  const corpo =
    linhas ||
    `<tr><td colspan="2" style="padding:14px 12px;color:${MUTED};font-size:13px;text-align:center;">${escapeHtml(vazioMsg)}</td></tr>`;

  return `
    <div style="font-size:14px;font-weight:800;color:${INK};margin:16px 0 8px;">${escapeHtml(titulo)} (${frotas.length})</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
      <thead><tr style="background:${BLUE};color:#ffffff;">
        <th style="padding:10px 8px;text-align:left;">Frota</th>
        <th style="padding:10px 8px;text-align:left;">Placa</th>
      </tr></thead>
      <tbody>${corpo}</tbody>
    </table>`;
}

export function renderRelatorioOperacionalDiario(
  input: RelatorioOperacionalDiarioInput,
  dataRef: Date,
  options: ReportOptions = {}
): string {
  const totalFrotas = input.frotasFizeram.length + input.frotasNaoFizeram.length;
  const pctEmDia = percent(input.frotasFizeram.length, totalFrotas);

  const pendenciasLinhas = input.pendenciasPorFrota
    .flatMap((grupo) => grupo.itens.map((item, index) => ({ grupo, item, first: index === 0 })))
    .map(({ grupo, item, first }, rowIndex) => {
      const bg = rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background:${bg};">
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:${INK};">${first ? display(grupo.frota_geral ?? grupo.frota_id) : ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${display(item.item_nome)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${badge(item.gravidade, pendenciaGravidadeTone(item.gravidade))}</td>
      </tr>`;
    })
    .join("");
  const pendenciasCorpo =
    pendenciasLinhas ||
    `<tr><td colspan="3" style="padding:14px 12px;color:${MUTED};font-size:13px;text-align:center;">Nenhuma pendência criada no dia.</td></tr>`;

  return shell(`
    ${header(
      "Relatório operacional diário",
      `${formatReportDate(dataRef)} · checklists e pendências do dia`,
      options
    )}
    <tr>
      <td style="background:#ffffff;border:1px solid ${BORDER};border-top:0;padding:22px 24px 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 -6px 18px;">
          <tr>
            ${summaryCell("Checklists realizados", formatNumber(input.totalChecklists), BLUE)}
            ${summaryCell("Apontamentos", formatNumber(input.totalApontamentos), "#dc2626")}
            ${summaryCell("Frotas em dia", `${input.frotasFizeram.length}/${totalFrotas}`, "#059669", pctEmDia)}
          </tr>
        </table>
        ${frotasChecklistTable("✅ Frotas que fizeram checklist", input.frotasFizeram, "Nenhuma frota fez checklist hoje.")}
        ${frotasChecklistTable("🚫 Frotas que não fizeram checklist", input.frotasNaoFizeram, "Todas as frotas fizeram checklist hoje.")}
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-bottom:1px solid ${BORDER};border-radius:0 0 14px 14px;padding:0 24px 24px;">
        <div style="font-size:14px;font-weight:800;color:${INK};margin:4px 0 10px;">Pendências do dia por frota</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
          <thead><tr style="background:${BLUE};color:#ffffff;">
            <th style="padding:10px 8px;text-align:left;">Frota</th>
            <th style="padding:10px 8px;text-align:left;">Item</th>
            <th style="padding:10px 8px;text-align:left;">Gravidade</th>
          </tr></thead>
          <tbody>${pendenciasCorpo}</tbody>
        </table>
      </td>
    </tr>`);
}
```

- [ ] **Step 2: Type-check the file**

Run: `npx tsc --noEmit`
Expected: no new errors in `lib/email-templates.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/email-templates.ts
git commit -m "feat(email): add renderRelatorioOperacionalDiario using the shared email design system"
```

---

### Task 5: Send function

**Files:**
- Modify: `lib/email.ts`

**Interfaces:**
- Consumes: `renderRelatorioOperacionalDiario`, `RelatorioOperacionalDiarioInput` (Task 4, `@/lib/email-templates`); `formatReportDate` (already imported in this file); `FROM`, `EMAIL_LOGO_URL`, `mailClient`, `safeLogEmail`, `sendGridErrorMessage`, `publicEmailErrorMessage`, `SendResult` (all already defined in this file).
- Produces: `export async function sendRelatorioOperacionalDiario(args: { destinatarios: string[]; input: RelatorioOperacionalDiarioInput; dataRef: Date; enviadoPor?: string }): Promise<SendResult>`

- [ ] **Step 1: Extend the import from `@/lib/email-templates`**

In `lib/email.ts`, change the existing import block to add the two new names:

```typescript
import {
  renderRelatorioGeral,
  renderRelatorioIndividual,
  renderRelatorioOperacionalDiario,
  renderRelatorioPainelExecutivo,
  renderSinistroNotification,
  renderSocorroNotification,
  type DashboardReportInput,
  type RelatorioOperacionalDiarioInput,
  type SinistroNotificationInput,
  type SocorroNotificationInput,
} from "@/lib/email-templates";
```

- [ ] **Step 2: Add the send function**

Add to `lib/email.ts`, after `sendRelatorioDiarioIa` (before `sendRelatorioIndividual`):

```typescript
export async function sendRelatorioOperacionalDiario(args: {
  destinatarios: string[];
  input: RelatorioOperacionalDiarioInput;
  dataRef: Date;
  enviadoPor?: string;
}): Promise<SendResult> {
  const assunto = `[Frotas] Relatório operacional — ${formatReportDate(args.dataRef)}`;
  const html = renderRelatorioOperacionalDiario(args.input, args.dataRef, { logoImageSrc: EMAIL_LOGO_URL });
  const destinatarios = args.destinatarios.join(",");
  const enviadoPor = args.enviadoPor ?? "sistema";

  try {
    await mailClient().send({
      from: FROM,
      to: args.destinatarios,
      subject: assunto,
      html,
    });
    await safeLogEmail({
      tipo: "operacional_diario",
      destinatarios,
      assunto,
      enviadoPor,
      status: "enviado",
    });
    return { ok: true };
  } catch (e) {
    const msg = sendGridErrorMessage(e);
    console.error("Erro no envio do relatório operacional diário", msg);
    await safeLogEmail({
      tipo: "operacional_diario",
      destinatarios,
      assunto,
      enviadoPor,
      status: "erro",
      erroMsg: msg,
    });
    return { ok: false, error: publicEmailErrorMessage(msg) };
  }
}
```

- [ ] **Step 3: Type-check the file**

Run: `npx tsc --noEmit`
Expected: no new errors in `lib/email.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/email.ts
git commit -m "feat(email): add sendRelatorioOperacionalDiario"
```

---

### Task 6: API route

**Files:**
- Create: `app/api/relatorios/operacional-diario/route.ts`

**Interfaces:**
- Consumes: `getChecklistsRealizadosNoDia`, `getFrotasComSemChecklistNoDia`, `getPendenciasCriadasNoDiaPorFrota` (Task 3, `@/lib/repos/relatorios`); `sendRelatorioOperacionalDiario` (Task 5, `@/lib/email`); `claimDueEmailSchedules`, `completeEmailSchedule`, `releaseEmailScheduleClaim` (existing, `@/lib/repos/email-schedule`); `isInternalAuthorized` (existing, `@/lib/internal-auth`); `reportCalendarDate`, `shiftCalendarDate`, `reportDayUtcRange` (existing, `@/lib/report-date`); `apiError` (existing, `@/lib/api-error`).
- Produces: `POST /api/relatorios/operacional-diario` — mirrors the contract of `POST /api/relatorios/daily` (auth via `x-internal-secret`, JSON response with `enviado`/`aviso`/`erro_envio`).

- [ ] **Step 1: Create the route file**

```typescript
// app/api/relatorios/operacional-diario/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getChecklistsRealizadosNoDia,
  getFrotasComSemChecklistNoDia,
  getPendenciasCriadasNoDiaPorFrota,
} from "@/lib/repos/relatorios";
import { sendRelatorioOperacionalDiario } from "@/lib/email";
import {
  claimDueEmailSchedules,
  completeEmailSchedule,
  releaseEmailScheduleClaim,
} from "@/lib/repos/email-schedule";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { reportCalendarDate, reportDayUtcRange, shiftCalendarDate } from "@/lib/report-date";
import { apiError } from "@/lib/api-error";

export async function GET() {
  const response = apiError("Use POST para executar o envio.", 405, "METHOD_NOT_ALLOWED");
  response.headers.set("Allow", "POST");
  return response;
}

export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) return apiError("Unauthorized", 401, "INVALID_INTERNAL_TOKEN");

  const ontem = shiftCalendarDate(reportCalendarDate(), -1);
  const dataRef = new Date(reportDayUtcRange(ontem).start);

  const [totalChecklists, frotasChecklist, pendenciasPorFrota] = await Promise.all([
    getChecklistsRealizadosNoDia(ontem),
    getFrotasComSemChecklistNoDia(ontem),
    getPendenciasCriadasNoDiaPorFrota(ontem),
  ]);

  const totalApontamentos = pendenciasPorFrota.reduce((sum, grupo) => sum + grupo.itens.length, 0);

  const schedules = await claimDueEmailSchedules({ limit: 25, tipo: "RELATORIO_OPERACIONAL_DIARIO" });

  const destinatarios = Array.from(
    new Set(
      schedules
        .flatMap((s) => s.destinatarios ?? [])
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (destinatarios.length === 0) {
    await Promise.all(schedules.map((schedule) => releaseEmailScheduleClaim(schedule)));
    return NextResponse.json({
      aviso: "Nenhuma agenda ativa do tipo RELATORIO_OPERACIONAL_DIARIO. Cadastre em /administracao/emails.",
      data: ontem,
    });
  }

  const sendResult = await sendRelatorioOperacionalDiario({
    destinatarios,
    dataRef,
    input: {
      totalChecklists,
      totalApontamentos,
      frotasFizeram: frotasChecklist.fizeram,
      frotasNaoFizeram: frotasChecklist.naoFizeram,
      pendenciasPorFrota,
    },
  });

  if (sendResult.ok) {
    await Promise.all(schedules.map((schedule) => completeEmailSchedule(schedule, new Date())));
  } else {
    await Promise.all(schedules.map((schedule) => releaseEmailScheduleClaim(schedule)));
  }

  return NextResponse.json(
    {
      data: ontem,
      total_checklists: totalChecklists,
      total_apontamentos: totalApontamentos,
      frotas_fizeram: frotasChecklist.fizeram.length,
      frotas_nao_fizeram: frotasChecklist.naoFizeram.length,
      destinatarios,
      enviado: sendResult.ok,
      erro_envio: sendResult.ok ? null : sendResult.error,
    },
    { status: sendResult.ok ? 200 : 502 }
  );
}
```

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/relatorios/operacional-diario/route.ts
git commit -m "feat(api): add POST /api/relatorios/operacional-diario endpoint"
```

---

### Task 7: Register the new schedule type in the admin UI

**Files:**
- Modify: `app/(app)/administracao/emails/_actions.ts`
- Modify: `app/(app)/administracao/emails/page.tsx`

**Interfaces:**
- No new exports — extends existing `ScheduleSchema.tipo` enum and `TIPO_LABELS` map so the admin UI at `/administracao/emails` can create/list schedules of type `RELATORIO_OPERACIONAL_DIARIO`.

- [ ] **Step 1: Add the new type to the Zod enum**

In `app/(app)/administracao/emails/_actions.ts`, find:

```typescript
  tipo: z.enum([
    "DISPONIBILIDADE",
    "PREVENTIVAS_ATRASO",
    "LAVAGEM_PENDENTE",
    "TACOGRAFO_VENCIDO",
    "FROTAS_PARADAS",
    "CUSTOS",
    "ALERTAS",
    "RELATORIO_DIARIO_IA",
  ]),
```

Replace with:

```typescript
  tipo: z.enum([
    "DISPONIBILIDADE",
    "PREVENTIVAS_ATRASO",
    "LAVAGEM_PENDENTE",
    "TACOGRAFO_VENCIDO",
    "FROTAS_PARADAS",
    "CUSTOS",
    "ALERTAS",
    "RELATORIO_DIARIO_IA",
    "RELATORIO_OPERACIONAL_DIARIO",
  ]),
```

- [ ] **Step 2: Add the label**

In `app/(app)/administracao/emails/page.tsx`, find:

```typescript
const TIPO_LABELS: Record<string, string> = {
  DISPONIBILIDADE: "Disponibilidade",
  PREVENTIVAS_ATRASO: "Preventivas em atraso",
  LAVAGEM_PENDENTE: "Lavagem pendente",
  TACOGRAFO_VENCIDO: "Tacógrafo vencido",
  FROTAS_PARADAS: "Frotas paradas",
  CUSTOS: "Custos",
  ALERTAS: "Alertas operacionais",
  RELATORIO_DIARIO_IA: "Relatório diário IA",
};
```

Replace with:

```typescript
const TIPO_LABELS: Record<string, string> = {
  DISPONIBILIDADE: "Disponibilidade",
  PREVENTIVAS_ATRASO: "Preventivas em atraso",
  LAVAGEM_PENDENTE: "Lavagem pendente",
  TACOGRAFO_VENCIDO: "Tacógrafo vencido",
  FROTAS_PARADAS: "Frotas paradas",
  CUSTOS: "Custos",
  ALERTAS: "Alertas operacionais",
  RELATORIO_DIARIO_IA: "Relatório diário IA",
  RELATORIO_OPERACIONAL_DIARIO: "Relatório operacional diário",
};
```

- [ ] **Step 3: Type-check**

The `<select>` at `app/(app)/administracao/emails/page.tsx:70-78` already renders its `<option>` list via `Object.entries(TIPO_LABELS).map(...)`, so Step 2 alone makes the new type selectable — no separate `<option>` to add.

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/administracao/emails/_actions.ts" "app/(app)/administracao/emails/page.tsx"
git commit -m "feat(admin): allow scheduling RELATORIO_OPERACIONAL_DIARIO from the emails admin page"
```

---

### Task 8: Keep the generic scheduled-email processor from touching the new type

**Files:**
- Modify: `app/api/email/send-scheduled/route.ts`

**Interfaces:**
- No new exports. `RELATORIO_OPERACIONAL_DIARIO` schedules must only be processed by `POST /api/relatorios/operacional-diario` (Task 6), the same way `RELATORIO_DIARIO_IA` is excluded from this generic processor via `claimDueEmailSchedules({ excludeTipo: "RELATORIO_DIARIO_IA" })`. The underlying `claim_email_schedules` Postgres function only accepts a single `p_exclude_tipo` value, so a second exclusion is handled by releasing the claim in application code instead of changing the RPC signature.

- [ ] **Step 1: Add the guard inside the processing loop**

In `app/api/email/send-scheduled/route.ts`, inside the `for (const schedule of schedules) {` loop (around line 269), immediately after the `try {` line and before the existing `if (schedule.tipo !== "DISPONIBILIDADE")` check, add:

```typescript
      if (schedule.tipo === "RELATORIO_OPERACIONAL_DIARIO") {
        await releaseEmailScheduleClaim(schedule);
        continue;
      }
```

So the loop body starts:

```typescript
  for (const schedule of schedules) {
    const failureCountBefore = falhas.length;

    try {
      if (schedule.tipo === "RELATORIO_OPERACIONAL_DIARIO") {
        await releaseEmailScheduleClaim(schedule);
        continue;
      }
      if (schedule.tipo !== "DISPONIBILIDADE") {
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/email/send-scheduled/route.ts
git commit -m "fix(email): exclude RELATORIO_OPERACIONAL_DIARIO from the generic scheduled-email processor"
```

---

### Task 9: GitHub Actions cron workflow

**Files:**
- Create: `.github/workflows/daily-report-operacional.yml`

**Interfaces:**
- Produces: a scheduled workflow that POSTs to `/api/relatorios/operacional-diario` daily at 7am Manaus time, mirroring `.github/workflows/daily-report.yml`.

- [ ] **Step 1: Create the workflow file**

```yaml
name: Relatorio Operacional Diario

permissions:
  contents: read

on:
  schedule:
    # 11:00 UTC = 07:00 Manaus (UTC-4, sem horario de verao)
    # GitHub Actions cron pode atrasar ate ~15min, suficiente pra relatorio diario.
    - cron: "0 11 * * *"
  workflow_dispatch:
    # Permite disparar manualmente em Actions > Relatorio Operacional Diario > Run workflow

concurrency:
  group: daily-report-operacional
  cancel-in-progress: false

jobs:
  send-report:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Chamar /api/relatorios/operacional-diario
        env:
          ENDPOINT: https://gestaofrotas.azurewebsites.net/api/relatorios/operacional-diario
          SECRET: ${{ secrets.FROTAS_INTERNAL_SECRET }}
        run: |
          if [ -z "$SECRET" ]; then
            echo "::error::Secret FROTAS_INTERNAL_SECRET nao configurado no repo (Settings > Secrets and variables > Actions)."
            exit 1
          fi

          HTTP_CODE=$(curl -sS -o response.json -w "%{http_code}" \
            -X POST "$ENDPOINT" \
            -H "x-internal-secret: $SECRET" \
            --max-time 120)

          echo "HTTP $HTTP_CODE"
          if [ "$HTTP_CODE" != "200" ]; then
            echo "::error::Endpoint retornou $HTTP_CODE"
            exit 1
          fi

          ENVIADO=$(jq -r '.enviado // false' response.json)
          AVISO=$(jq -r '.aviso // empty' response.json)

          if [ -n "$AVISO" ]; then
            echo "::warning::$AVISO"
          fi

          if [ "$ENVIADO" != "true" ]; then
            ERRO=$(jq -r '.erro_envio // .aviso // "envio nao confirmado"' response.json)
            echo "::warning::Relatorio nao foi enviado: $ERRO"
          else
            DEST_COUNT=$(jq -r '.destinatarios | length' response.json)
            CHECKLISTS=$(jq -r '.total_checklists // 0' response.json)
            APONTAMENTOS=$(jq -r '.total_apontamentos // 0' response.json)
            echo "::notice::Relatorio enviado (destinatarios=$DEST_COUNT, checklists=$CHECKLISTS, apontamentos=$APONTAMENTOS)"
          fi
```

- [ ] **Step 2: Validate the YAML**

Run: `npx yaml-lint .github/workflows/daily-report-operacional.yml 2>/dev/null || cat .github/workflows/daily-report-operacional.yml` (if `yaml-lint` isn't installed, a visual diff against `daily-report.yml`'s structure is sufficient — the two files should differ only in name, cron time, concurrency group, endpoint URL, and the jq fields read from the response).

Expected: valid YAML, structurally parallel to `daily-report.yml`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/daily-report-operacional.yml
git commit -m "feat(ci): add daily cron workflow for the operational report"
```

---

### Task 10: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test` (or `npx vitest run`)
Expected: all tests pass, including the 5 new ones from Task 2.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds with no type errors, including the new route `app/api/relatorios/operacional-diario/route.ts`.

- [ ] **Step 3: Register a test schedule via the admin UI**

Start the dev server (`npm run dev`), sign in, go to `/administracao/emails`, create a schedule with `tipo = RELATORIO_OPERACIONAL_DIARIO`, `frequencia = DIARIO`, and a real recipient email you can check.

Expected: schedule saves without a DB constraint error (confirms Task 1's migration was applied).

- [ ] **Step 4: Trigger the endpoint locally**

With the dev server running and `FROTAS_INTERNAL_SECRET` set in `.env.local`:

```bash
curl -sS -X POST http://localhost:3000/api/relatorios/operacional-diario \
  -H "x-internal-secret: $FROTAS_INTERNAL_SECRET" | jq
```

Expected: JSON response with `enviado: true` (or a clear `erro_envio` if SendGrid isn't configured locally — in that case, confirm `html_preview`-equivalent fields and the KPI numbers look correct instead).

- [ ] **Step 5: Visually inspect the received email**

Open the test recipient's inbox. Confirm: header uses the shared blue banner + logo (same as other Frotas emails, not the old inline-CSS look), KPI cards show checklists/apontamentos/frotas em dia, the ✅/🚫 fleet tables and the pendências-by-fleet table render correctly, and Portuguese labels/accents display correctly (no mojibake).

Expected: visually consistent with `renderRelatorioGeral`'s emails.

- [ ] **Step 6: Confirm the generic scheduled-email processor skips the new type**

```bash
curl -sS -X POST http://localhost:3000/api/email/send-scheduled \
  -H "x-internal-secret: $FROTAS_INTERNAL_SECRET" | jq
```

Expected: the `RELATORIO_OPERACIONAL_DIARIO` schedule created in Step 3 is not reported as sent or failed by this endpoint (it should have been released back to `ativo` with no `processing_token`, ready for the dedicated endpoint).

- [ ] **Step 7: Clean up the test schedule**

Delete the test schedule created in Step 3 via `/administracao/emails` (or leave it active if the recipient should keep receiving the report going forward).
