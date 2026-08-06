# Relatório Operacional: Observações de Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include free-text checklist observations (`checklists_frota.observacao_corrigida_ia`/`observacao_original`) in the daily operational report — a new "Observações do dia" email section, plus folding their count into the "Apontamentos" KPI alongside structured pendências.

**Architecture:** Add a new repo function (data-fetch) + pure grouping helper in `lib/repos/relatorios.ts`, mirroring the existing `getPendenciasCriadasNoDiaPorFrota`/`agruparPendenciasPorFrota` pattern exactly. Add a new field + render section to the existing `renderRelatorioOperacionalDiario` template. Wire the new data into both call sites that already build this report's input (`app/api/relatorios/operacional-diario/route.ts` and `app/(app)/administracao/emails/_actions.ts`'s `triggerScheduleNowAction`).

**Tech Stack:** Next.js App Router, Supabase (`@supabase/supabase-js`, no ORM), Vitest.

## Global Constraints

- D-1 date handling is already correct (verified) — do not change any date computation in this plan.
- Observation text fallback: `observacao_corrigida_ia?.trim() || observacao_original?.trim() || ""`, then filter out empty results — exact same rule already used in `app/(app)/checklists/page.tsx:88-89`.
- Observations get their own email section ("Observações do dia"), never merged into the "Pendências do dia por frota" table (different shape: no gravidade/item_nome).
- The "Apontamentos" KPI = count of structured pendência items + count of checklists-with-observação, summed. This sum is computed by the caller (route/action), not inside the render function.
- Scope is the previous full calendar day (`ontem`), same window already used for pendências/checklists — no backlog.

---

### Task 1: Data layer — fetch + group observations

**Files:**
- Modify: `lib/repos/relatorios.ts`
- Modify: `lib/repos/relatorios.test.ts`

**Interfaces:**
- Consumes: `supabaseManutencao` (already imported), `reportDayUtcRange` (already imported), `frotaSortKey`/`compareFrotaKeys` (already defined in this file, private).
- Produces:
  - `export type ObservacaoComFrota = { frota_id: number; frota_geral: string | null; placa: string | null; motorista_nome: string | null; observacao: string }`
  - `export type ObservacaoGrupoFrota = { frota_id: number; frota_geral: string | null; placa: string | null; observacoes: { motorista_nome: string | null; observacao: string }[] }`
  - `export function agruparObservacoesPorFrota(observacoes: ObservacaoComFrota[]): ObservacaoGrupoFrota[]`
  - `export async function getObservacoesCriadasNoDiaPorFrota(date: string): Promise<ObservacaoGrupoFrota[]>`

- [ ] **Step 1: Write the failing tests for the pure grouping function**

Add to `lib/repos/relatorios.test.ts` (append at the end of the file; the file already has `describe("splitFrotasPorChecklist", ...)` and `describe("agruparPendenciasPorFrota", ...)` blocks above — follow the same style, including the existing `vi.mock("server-only", ...)`/`vi.mock("@/lib/supabase-manutencao", ...)` shims already at the top of this file, which you don't need to touch):

```typescript
describe("agruparObservacoesPorFrota", () => {
  it("groups observacoes by frota_id preserving item order", () => {
    const observacoes = [
      { frota_id: 1, frota_geral: "10", placa: "AAA-0001", motorista_nome: "Bruno", observacao: "Levando para revisão" },
      { frota_id: 1, frota_geral: "10", placa: "AAA-0001", motorista_nome: "Bruno", observacao: "Pouco óleo nos freios" },
      { frota_id: 2, frota_geral: "5", placa: "BBB-0002", motorista_nome: "Carlos", observacao: "Farol queimado" },
    ];

    const result = agruparObservacoesPorFrota(observacoes);

    expect(result).toHaveLength(2);
    expect(result[0].frota_id).toBe(2);
    expect(result[0].observacoes).toEqual([{ motorista_nome: "Carlos", observacao: "Farol queimado" }]);
    expect(result[1].frota_id).toBe(1);
    expect(result[1].observacoes).toEqual([
      { motorista_nome: "Bruno", observacao: "Levando para revisão" },
      { motorista_nome: "Bruno", observacao: "Pouco óleo nos freios" },
    ]);
  });

  it("returns an empty array for no observacoes", () => {
    expect(agruparObservacoesPorFrota([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/repos/relatorios.test.ts`
Expected: FAIL — `agruparObservacoesPorFrota` is not exported from `lib/repos/relatorios.ts`.

- [ ] **Step 3: Implement the pure helper and the async data-fetch function**

Add to `lib/repos/relatorios.ts`, after `agruparPendenciasPorFrota` (before `getRelatorioKpis`):

```typescript
export type ObservacaoComFrota = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  motorista_nome: string | null;
  observacao: string;
};

export type ObservacaoGrupoFrota = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  observacoes: { motorista_nome: string | null; observacao: string }[];
};

export function agruparObservacoesPorFrota(observacoes: ObservacaoComFrota[]): ObservacaoGrupoFrota[] {
  const map = new Map<number, ObservacaoGrupoFrota>();

  for (const o of observacoes) {
    const existing = map.get(o.frota_id);
    if (existing) {
      existing.observacoes.push({ motorista_nome: o.motorista_nome, observacao: o.observacao });
    } else {
      map.set(o.frota_id, {
        frota_id: o.frota_id,
        frota_geral: o.frota_geral,
        placa: o.placa,
        observacoes: [{ motorista_nome: o.motorista_nome, observacao: o.observacao }],
      });
    }
  }

  return [...map.values()].sort((a, b) => compareFrotaKeys(frotaSortKey(a), frotaSortKey(b)));
}
```

Then add the async function, after `getPendenciasCriadasNoDiaPorFrota` (at the end of the file):

```typescript
export async function getObservacoesCriadasNoDiaPorFrota(date: string): Promise<ObservacaoGrupoFrota[]> {
  const { start, end } = reportDayUtcRange(date);

  const rows: {
    frota_id: number;
    motorista_nome: string | null;
    observacao_original: string | null;
    observacao_corrigida_ia: string | null;
  }[] = [];
  const chunkSize = 1000;
  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await supabaseManutencao
      .from("checklists_frota")
      .select("frota_id,motorista_nome,observacao_original,observacao_corrigida_ia")
      .gte("data_checklist", start)
      .lt("data_checklist", end)
      .order("id", { ascending: true })
      .range(from, from + chunkSize - 1);
    if (error) throw new Error(`getObservacoesCriadasNoDiaPorFrota: ${error.message}`);
    const chunk = (data ?? []) as typeof rows;
    rows.push(...chunk);
    if (chunk.length < chunkSize) break;
  }

  const comObservacao = rows
    .map((r) => ({
      frota_id: r.frota_id,
      motorista_nome: r.motorista_nome,
      observacao: r.observacao_corrigida_ia?.trim() || r.observacao_original?.trim() || "",
    }))
    .filter((r) => r.observacao.length > 0);

  const frotaIds = [...new Set(comObservacao.map((r) => r.frota_id))];
  if (frotaIds.length === 0) return [];

  const { data: veiculos, error: veiculosError } = await supabaseManutencao
    .from("veiculos")
    .select("id,codigo_frota,placa")
    .in("id", frotaIds);
  if (veiculosError) throw new Error(`getObservacoesCriadasNoDiaPorFrota veiculos: ${veiculosError.message}`);

  const veiculoMap = new Map(
    (veiculos ?? []).map((v) => [Number(v.id), v as { id: number; codigo_frota: string | null; placa: string | null }])
  );

  const observacoesComFrota: ObservacaoComFrota[] = comObservacao.map((r) => ({
    frota_id: r.frota_id,
    frota_geral: veiculoMap.get(r.frota_id)?.codigo_frota ?? null,
    placa: veiculoMap.get(r.frota_id)?.placa ?? null,
    motorista_nome: r.motorista_nome,
    observacao: r.observacao,
  }));

  return agruparObservacoesPorFrota(observacoesComFrota);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/repos/relatorios.test.ts`
Expected: PASS — all tests green (the 2 new plus the pre-existing ones in this file).

- [ ] **Step 5: Run the full suite and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/repos/relatorios.ts lib/repos/relatorios.test.ts
git commit -m "feat(relatorios): add checklist observation fetch and grouping for the operational report"
```

---

### Task 2: Email template — new "Observações do dia" section

**Files:**
- Modify: `lib/email-templates.ts`

**Interfaces:**
- Consumes: `display`, `BLUE`, `INK`, `MUTED`, `BORDER` (all already defined in this file); `ObservacaoGrupoFrota`'s shape (not imported as a type — this file already inlines the pendências shape structurally rather than importing from `lib/repos/relatorios.ts`, so mirror that same convention: extend `RelatorioOperacionalDiarioInput` with an inline-typed field).
- Produces: `RelatorioOperacionalDiarioInput` gains `observacoesPorFrota`; `renderRelatorioOperacionalDiario` renders the new section.

- [ ] **Step 1: Extend the input type**

In `lib/email-templates.ts`, find:

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
```

Replace with:

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
  observacoesPorFrota: {
    frota_id: number;
    frota_geral: string | null;
    placa: string | null;
    observacoes: { motorista_nome: string | null; observacao: string }[];
  }[];
};
```

- [ ] **Step 2: Add the new section to the render function**

In `lib/email-templates.ts`, inside `renderRelatorioOperacionalDiario`, find the block that builds `pendenciasCorpo`:

```typescript
  const pendenciasCorpo =
    pendenciasLinhas ||
    `<tr><td colspan="3" style="padding:14px 12px;color:${MUTED};font-size:13px;text-align:center;">Nenhuma pendência criada no dia.</td></tr>`;
```

Immediately after that block (still before the `return shell(...)` line), add:

```typescript
  const observacoesLinhas = input.observacoesPorFrota
    .flatMap((grupo) => grupo.observacoes.map((obs, index) => ({ grupo, obs, first: index === 0 })))
    .map(({ grupo, obs, first }, rowIndex) => {
      const bg = rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background:${bg};">
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:${INK};">${first ? display(grupo.frota_geral ?? grupo.frota_id) : ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${display(obs.motorista_nome)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${display(obs.observacao)}</td>
      </tr>`;
    })
    .join("");
  const observacoesCorpo =
    observacoesLinhas ||
    `<tr><td colspan="3" style="padding:14px 12px;color:${MUTED};font-size:13px;text-align:center;">Nenhuma observação registrada no dia.</td></tr>`;
```

Then find the closing of the function:

```typescript
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

Replace the closing `</td>\n    </tr>`);\n}` with a new `<tr>` block for observations, inserted right after the pendências `</table>` and before the closing `</td></tr>`):

```typescript
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
    </tr>
    <tr>
      <td style="background:#ffffff;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-bottom:1px solid ${BORDER};border-radius:0 0 14px 14px;padding:0 24px 24px;">
        <div style="font-size:14px;font-weight:800;color:${INK};margin:4px 0 10px;">Observações do dia</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
          <thead><tr style="background:${BLUE};color:#ffffff;">
            <th style="padding:10px 8px;text-align:left;">Frota</th>
            <th style="padding:10px 8px;text-align:left;">Motorista</th>
            <th style="padding:10px 8px;text-align:left;">Observação</th>
          </tr></thead>
          <tbody>${observacoesCorpo}</tbody>
        </table>
      </td>
    </tr>`);
}
```

Note: this duplicates the section wrapper's `border-radius:0 0 14px 14px` (rounded bottom corners) on BOTH the pendências `<tr>` and the new observações `<tr>` — that's fine visually in email HTML (each `<td>` gets its own rounded corners, they just stack), matching how this template already handles multiple `<tr>` sections after the header row.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors — this will surface as an error in the two call sites (Tasks 3-4) until they're updated, which is expected and fixed by those tasks.

- [ ] **Step 4: Commit**

```bash
git add lib/email-templates.ts
git commit -m "feat(email): add Observações do dia section to renderRelatorioOperacionalDiario"
```

---

### Task 3: Wire into the API route

**Files:**
- Modify: `app/api/relatorios/operacional-diario/route.ts`

**Interfaces:**
- Consumes: `getObservacoesCriadasNoDiaPorFrota` (Task 1, `@/lib/repos/relatorios`).

- [ ] **Step 1: Add the import**

In `app/api/relatorios/operacional-diario/route.ts`, change:

```typescript
import {
  getChecklistsRealizadosNoDia,
  getFrotasComSemChecklistNoDia,
  getPendenciasCriadasNoDiaPorFrota,
} from "@/lib/repos/relatorios";
```

to:

```typescript
import {
  getChecklistsRealizadosNoDia,
  getFrotasComSemChecklistNoDia,
  getPendenciasCriadasNoDiaPorFrota,
  getObservacoesCriadasNoDiaPorFrota,
} from "@/lib/repos/relatorios";
```

- [ ] **Step 2: Fetch observations in parallel and recompute the KPI**

Change:

```typescript
  const [totalChecklists, frotasChecklist, pendenciasPorFrota] = await Promise.all([
    getChecklistsRealizadosNoDia(ontem),
    getFrotasComSemChecklistNoDia(ontem),
    getPendenciasCriadasNoDiaPorFrota(ontem),
  ]);

  const totalApontamentos = pendenciasPorFrota.reduce((sum, grupo) => sum + grupo.itens.length, 0);
```

to:

```typescript
  const [totalChecklists, frotasChecklist, pendenciasPorFrota, observacoesPorFrota] = await Promise.all([
    getChecklistsRealizadosNoDia(ontem),
    getFrotasComSemChecklistNoDia(ontem),
    getPendenciasCriadasNoDiaPorFrota(ontem),
    getObservacoesCriadasNoDiaPorFrota(ontem),
  ]);

  const totalApontamentos =
    pendenciasPorFrota.reduce((sum, grupo) => sum + grupo.itens.length, 0) +
    observacoesPorFrota.reduce((sum, grupo) => sum + grupo.observacoes.length, 0);
```

- [ ] **Step 3: Pass `observacoesPorFrota` into the send call**

Change:

```typescript
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
```

to:

```typescript
  const sendResult = await sendRelatorioOperacionalDiario({
    destinatarios,
    dataRef,
    input: {
      totalChecklists,
      totalApontamentos,
      frotasFizeram: frotasChecklist.fizeram,
      frotasNaoFizeram: frotasChecklist.naoFizeram,
      pendenciasPorFrota,
      observacoesPorFrota,
    },
  });
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/relatorios/operacional-diario/route.ts
git commit -m "feat(api): include checklist observations in the operational-diario report endpoint"
```

---

### Task 4: Wire into the manual-trigger action

**Files:**
- Modify: `app/(app)/administracao/emails/_actions.ts`

**Interfaces:**
- Consumes: `getObservacoesCriadasNoDiaPorFrota` (Task 1, `@/lib/repos/relatorios`).

- [ ] **Step 1: Add the import**

In `app/(app)/administracao/emails/_actions.ts`, find the existing import block for `@/lib/repos/relatorios`:

```typescript
import {
  getChecklistsRealizadosNoDia,
  getFrotasComSemChecklistNoDia,
  getPendenciasCriadasNoDiaPorFrota,
} from "@/lib/repos/relatorios";
```

Change to:

```typescript
import {
  getChecklistsRealizadosNoDia,
  getFrotasComSemChecklistNoDia,
  getPendenciasCriadasNoDiaPorFrota,
  getObservacoesCriadasNoDiaPorFrota,
} from "@/lib/repos/relatorios";
```

- [ ] **Step 2: Fetch observations and recompute the KPI in the `RELATORIO_OPERACIONAL_DIARIO` branch**

In the `else if (schedule.tipo === "RELATORIO_OPERACIONAL_DIARIO")` branch of `triggerScheduleNowAction`, change:

```typescript
      const ontem = shiftCalendarDate(reportCalendarDate(), -1);
      const dataRef = new Date(reportDayUtcRange(ontem).start);
      const [totalChecklists, frotasChecklist, pendenciasPorFrota] = await Promise.all([
        getChecklistsRealizadosNoDia(ontem),
        getFrotasComSemChecklistNoDia(ontem),
        getPendenciasCriadasNoDiaPorFrota(ontem),
      ]);
      const totalApontamentos = pendenciasPorFrota.reduce((sum, grupo) => sum + grupo.itens.length, 0);
```

to:

```typescript
      const ontem = shiftCalendarDate(reportCalendarDate(), -1);
      const dataRef = new Date(reportDayUtcRange(ontem).start);
      const [totalChecklists, frotasChecklist, pendenciasPorFrota, observacoesPorFrota] = await Promise.all([
        getChecklistsRealizadosNoDia(ontem),
        getFrotasComSemChecklistNoDia(ontem),
        getPendenciasCriadasNoDiaPorFrota(ontem),
        getObservacoesCriadasNoDiaPorFrota(ontem),
      ]);
      const totalApontamentos =
        pendenciasPorFrota.reduce((sum, grupo) => sum + grupo.itens.length, 0) +
        observacoesPorFrota.reduce((sum, grupo) => sum + grupo.observacoes.length, 0);
```

- [ ] **Step 3: Pass `observacoesPorFrota` into the send call**

Immediately below, change:

```typescript
      const result = await sendRelatorioOperacionalDiario({
        destinatarios,
        dataRef,
        enviadoPor: user.email,
        scheduleId: schedule.id,
        input: {
          totalChecklists,
          totalApontamentos,
          frotasFizeram: frotasChecklist.fizeram,
          frotasNaoFizeram: frotasChecklist.naoFizeram,
          pendenciasPorFrota,
        },
      });
```

to:

```typescript
      const result = await sendRelatorioOperacionalDiario({
        destinatarios,
        dataRef,
        enviadoPor: user.email,
        scheduleId: schedule.id,
        input: {
          totalChecklists,
          totalApontamentos,
          frotasFizeram: frotasChecklist.fizeram,
          frotasNaoFizeram: frotasChecklist.naoFizeram,
          pendenciasPorFrota,
          observacoesPorFrota,
        },
      });
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/administracao/emails/_actions.ts"
git commit -m "feat(admin): include checklist observations in the manual operational-diario trigger"
```

---

### Task 5: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the 2 new tests from Task 1.

- [ ] **Step 2: Run the production build**

Run: `npm run build` with the same CI-equivalent dummy env vars used in prior verification passes on this codebase (`AZURE_AD_CLIENT_ID=build-validation`, `SUPABASE_MANUTENCAO_URL=https://build.supabase.invalid`, etc. — see any prior plan's Task 8/10 for the full list, or `.github/workflows/main_gestaofrotas.yml`'s `build` job `env:` block for the authoritative list).
Expected: build succeeds with no type errors.

- [ ] **Step 3: Manual UI verification (requires live Supabase/SendGrid credentials — document as follow-up if unavailable)**

1. Trigger the operational report (via `/api/relatorios/operacional-diario` with the internal secret, or via "Disparar agora" on a `RELATORIO_OPERACIONAL_DIARIO` schedule in `/administracao/emails`) for a day known to have checklist observações but no structured pendências (the exact scenario reported by the user).
2. Confirm the received email has:
   - A new "Observações do dia" section, below "Pendências do dia por frota", listing frota/motorista/texto for each checklist with a non-empty observação that day.
   - The "Apontamentos" KPI number reflects pendências + observações combined (not just pendências).
   - The "Pendências do dia por frota" section still shows "Nenhuma pendência criada no dia." when there are truly no structured pendências, unaffected by the new section.
3. Confirm a day with zero observações renders "Nenhuma observação registrada no dia." in the new section, not an empty table.
