# Relatório de Disponibilidade Unificado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the two divergent "disponibilidade de frotas" email templates (scheduled + manual) into one shared renderer matching the reference design (Unidade/Referência header, 4 KPIs, "Veículos em manutenção" table with Frota/Placa/Unidade/Setor/Tipo OS/Descrição/Status/Início/Prev. saída), and apply the same columns to the web page table.

**Architecture:** Extend `lib/repos/disponibilidade.ts` with `setor`/`status` fields on the existing maintenance-row type (no schema change — `setor` reuses the `veiculo.setor` column, `status` is a fixed `"PENDENTE"` literal). Add one new `renderDisponibilidadeEmail()` function to `lib/email-templates.ts` following the existing `shell()/header()/summaryCell()` pattern already used by `renderRelatorioOperacionalDiario`. Rewire the three send paths (scheduled cron, manual send from `/frotas/disponibilidades`, manual send from `/frotas`) to build data via the repo and call the new renderer, then delete the two old renderers. Finish by updating the web table to the same 9 columns.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (`@supabase/supabase-js`), Vitest, SendGrid (`@sendgrid/mail`).

## Global Constraints

- No new database columns or migrations — `setor` already exists on `veiculos` (backfilled 2026-08-12), `status` is a fixed string, not a stored field.
- `Status` column is always the literal `"PENDENTE"` — confirmed with the user, not configurable.
- Keep every existing exported function name stable unless a task explicitly renames it and updates every call site in the same task (never leave a dangling import).
- Follow the existing email design system in `lib/email-templates.ts` (`shell`, `header`, `summaryCell`, `badge`, `BLUE`/`INK`/`MUTED`/`BORDER` constants) — do not introduce a new inline `<style>` block like the old `buildDisponibilidadeEmail` did.
- Run `npx tsc --noEmit -p .` and `npx vitest run` after every task; both must pass before moving to the next task.

---

### Task 1: Add `setor` and `status` to the disponibilidade repo, with a testable mapping function

**Files:**
- Modify: `lib/repos/disponibilidade.ts`
- Create: `lib/repos/disponibilidade.test.ts`

**Interfaces:**
- Produces: `FrotaManutencaoDisponibilidade` gains `setor: string | null` and `status: "PENDENTE"`. New exported pure function `mapFrotaManutencao(row: VeiculoDisponibilidadeRow, agora: number): FrotaManutencaoDisponibilidade`. New exported functions `asCdResumo(resumo: DisponibilidadeCD | DisponibilidadeGeral, cdNome: string): DisponibilidadeCD` and `resumoTexto(cd: DisponibilidadeCD): string` (moved here from `lib/services/scheduled-report-senders.ts` — they're pure data-formatting helpers over `DisponibilidadeCD`, this repo is the natural home).

- [ ] **Step 1: Write the failing tests**

Create `lib/repos/disponibilidade.test.ts`:

```typescript
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-manutencao", () => ({
  supabaseManutencao: { from: vi.fn() },
}));

import { describe, expect, it } from "vitest";
import { mapFrotaManutencao, asCdResumo, resumoTexto } from "@/lib/repos/disponibilidade";

const AGORA = new Date("2026-08-12T12:00:00Z").getTime();

function baseRow(overrides: Partial<Parameters<typeof mapFrotaManutencao>[0]> = {}) {
  return {
    id: 1,
    codigo_frota: "246",
    placa: "QZM-1F71",
    modelo: "VUC",
    local: "CD Tarumã",
    status: "manutencao",
    status_operacional: "EM_MANUTENCAO",
    ativo: true,
    vendido: false,
    km_atualizado_em: null,
    ultimo_checklist_em: null,
    ultimo_motorista_nome: "Douglas Santos",
    manutencao_motivo: "HM - Pintura do Teto do Baú",
    manutencao_tipo: "CORRETIVA",
    manutencao_oficina: null,
    manutencao_destino: null,
    manutencao_destino_detalhe: null,
    manutencao_iniciado_em: "2026-08-03T00:00:00Z",
    manutencao_iniciado_por: null,
    manutencao_prev_retorno: "2026-08-10T00:00:00Z",
    setor: null as string | null,
    ...overrides,
  };
}

describe("mapFrotaManutencao", () => {
  it("uses setor when the vehicle has one cadastrado", () => {
    const row = baseRow({ setor: "CD TURISMO/ FARMA" });
    const result = mapFrotaManutencao(row, AGORA);
    expect(result.setor).toBe("CD TURISMO/ FARMA");
  });

  it("falls back to local (CD) when setor is null", () => {
    const row = baseRow({ setor: null, local: "CD Tarumã" });
    const result = mapFrotaManutencao(row, AGORA);
    expect(result.setor).toBe("CD Tarumã");
  });

  it("always reports status PENDENTE", () => {
    const row = baseRow();
    const result = mapFrotaManutencao(row, AGORA);
    expect(result.status).toBe("PENDENTE");
  });

  it("maps frota, placa, cd_nome and manutencao fields", () => {
    const row = baseRow();
    const result = mapFrotaManutencao(row, AGORA);
    expect(result.frota_geral).toBe("246");
    expect(result.placa).toBe("QZM-1F71");
    expect(result.cd_nome).toBe("CD Tarumã");
    expect(result.tipo).toBe("CORRETIVA");
    expect(result.motivo).toBe("HM - Pintura do Teto do Baú");
    expect(result.previsao_retorno).toBe("2026-08-10T00:00:00Z");
  });
});

describe("asCdResumo", () => {
  it("returns the same object when cd_nome is already present", () => {
    const resumo = {
      cd_nome: "CD Manaus",
      total: 10,
      disponiveis: 8,
      em_manutencao: 2,
      indisponiveis: 0,
      em_operacao: 5,
      paradas: 2,
      percentual_disponibilidade: 80,
      pontos_atencao: 1,
    };
    expect(asCdResumo(resumo, "Ignorado")).toEqual(resumo);
  });

  it("adds cd_nome when given a DisponibilidadeGeral", () => {
    const geral = {
      total: 10,
      disponiveis: 8,
      em_manutencao: 2,
      indisponiveis: 0,
      em_operacao: 5,
      paradas: 2,
      percentual_disponibilidade: 80,
      pontos_atencao: 1,
    };
    expect(asCdResumo(geral, "Todos os CDs")).toEqual({ cd_nome: "Todos os CDs", ...geral });
  });
});

describe("resumoTexto", () => {
  it("formats a one-line summary", () => {
    const cd = {
      cd_nome: "CD Manaus",
      total: 10,
      disponiveis: 8,
      em_manutencao: 2,
      indisponiveis: 0,
      em_operacao: 5,
      paradas: 2,
      percentual_disponibilidade: 80,
      pontos_atencao: 1,
    };
    expect(resumoTexto(cd)).toBe(
      "CD Manaus: 80% disponível, 8/10 frotas disponíveis, 2 em manutenção, 0 indisponíveis, 1 ponto(s) de atenção."
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/repos/disponibilidade.test.ts`
Expected: FAIL — `mapFrotaManutencao`, `asCdResumo`, `resumoTexto` are not exported yet.

- [ ] **Step 3: Implement in `lib/repos/disponibilidade.ts`**

Add `setor` to the select string and row type (near the top of the file):

```typescript
const VEICULOS_DISPONIBILIDADE_SELECT =
  "id,codigo_frota,placa,modelo,local,setor,status,status_operacional,ativo,vendido,km_atualizado_em,ultimo_checklist_em,ultimo_motorista_nome,manutencao_motivo,manutencao_tipo,manutencao_oficina,manutencao_destino,manutencao_destino_detalhe,manutencao_iniciado_em,manutencao_iniciado_por,manutencao_prev_retorno";

type VeiculoDisponibilidadeRow = {
  id: number;
  codigo_frota: string | null;
  placa: string | null;
  modelo: string | null;
  local: string | null;
  setor: string | null;
  status: string | null;
  status_operacional: string | null;
  ativo: boolean | null;
  vendido: boolean | null;
  km_atualizado_em: string | null;
  ultimo_checklist_em: string | null;
  ultimo_motorista_nome: string | null;
  manutencao_motivo: string | null;
  manutencao_tipo: string | null;
  manutencao_oficina: string | null;
  manutencao_destino?: string | null;
  manutencao_destino_detalhe?: string | null;
  manutencao_iniciado_em: string | null;
  manutencao_iniciado_por: string | null;
  manutencao_prev_retorno: string | null;
};
```

Update `FrotaManutencaoDisponibilidade`:

```typescript
export type FrotaManutencaoDisponibilidade = {
  id: number;
  frota_geral: string | null;
  placa: string | null;
  modelo: string | null;
  cd_nome: string;
  setor: string | null;
  status: "PENDENTE";
  motivo: string | null;
  tipo: string | null;
  data_envio: string | null;
  tempo_parado_dias: number | null;
  local_atual: string | null;
  responsavel: string | null;
  previsao_retorno: string | null;
};
```

Add the pure mapping function (near `diasDesde`, before `listFrotasEmManutencao`):

```typescript
export function mapFrotaManutencao(row: VeiculoDisponibilidadeRow, agora: number): FrotaManutencaoDisponibilidade {
  return {
    id: row.id,
    frota_geral: row.codigo_frota,
    placa: row.placa,
    modelo: row.modelo,
    cd_nome: normalizeCdNome(row.local),
    setor: row.setor ?? row.local,
    status: "PENDENTE",
    motivo: row.manutencao_motivo,
    tipo: row.manutencao_tipo,
    data_envio: row.manutencao_iniciado_em,
    tempo_parado_dias: diasDesde(row.manutencao_iniciado_em, agora),
    local_atual: row.manutencao_destino_detalhe ?? row.manutencao_oficina ?? row.manutencao_destino ?? row.local,
    responsavel: row.ultimo_motorista_nome ?? row.manutencao_iniciado_por,
    previsao_retorno: row.manutencao_prev_retorno,
  };
}
```

Simplify `listFrotasEmManutencao` to use it:

```typescript
export async function listFrotasEmManutencao(
  cdNome?: string,
  limite = 100
): Promise<FrotaManutencaoDisponibilidade[]> {
  const rows = await listVeiculosDisponibilidade();
  const agora = Date.now();

  return rows
    .filter((row) => isManutencao(row))
    .filter((row) => !cdNome || normalizeCdNome(row.local) === cdNome)
    .map((row) => mapFrotaManutencao(row, agora))
    .sort((a, b) => (b.tempo_parado_dias ?? -1) - (a.tempo_parado_dias ?? -1))
    .slice(0, limite);
}
```

Add `asCdResumo` and `resumoTexto` at the end of the file (moved from `lib/services/scheduled-report-senders.ts`, unchanged logic):

```typescript
export function asCdResumo(resumo: DisponibilidadeCD | DisponibilidadeGeral, cdNome: string): DisponibilidadeCD {
  return "cd_nome" in resumo ? resumo : { cd_nome: cdNome, ...resumo };
}

export function resumoTexto(cd: DisponibilidadeCD): string {
  return `${cd.cd_nome}: ${cd.percentual_disponibilidade}% disponível, ${cd.disponiveis}/${cd.total} frotas disponíveis, ${cd.em_manutencao} em manutenção, ${cd.indisponiveis} indisponíveis, ${cd.pontos_atencao} ponto(s) de atenção.`;
}
```

Note: `DisponibilidadeGeral` is already defined in this file (`export type DisponibilidadeGeral = Omit<DisponibilidadeCD, "cd_nome">;`) — no new import needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/repos/disponibilidade.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors (note: `lib/services/scheduled-report-senders.ts` still has its own local `asCdResumo`/`resumoTexto` at this point — that's fine, they're not deleted until Task 4).

- [ ] **Step 6: Commit**

```bash
git add lib/repos/disponibilidade.ts lib/repos/disponibilidade.test.ts
git commit -m "feat: adiciona setor e status ao repo de disponibilidade de frotas"
```

---

### Task 2: New shared e-mail template `renderDisponibilidadeEmail`

**Files:**
- Modify: `lib/email-templates.ts`

**Interfaces:**
- Consumes: `DisponibilidadeCD`, `FrotaManutencaoDisponibilidade`, `PontoAtencao` from `@/lib/repos/disponibilidade` (Task 1's `FrotaManutencaoDisponibilidade` shape, including new `setor`/`status`). `header`, `shell`, `summaryCell`, `badge`, `display`, `escapeHtml`, `formatNumber` already defined in this file.
- Produces: `export type DisponibilidadeEmailInput = { resumo: DisponibilidadeCD; manutencoes: FrotaManutencaoDisponibilidade[]; pontos: PontoAtencao[] }` and `export function renderDisponibilidadeEmail(input: DisponibilidadeEmailInput, dataRef: Date, options: ReportOptions = {}): string`.

- [ ] **Step 1: Add the import and type**

At the top of `lib/email-templates.ts`, add to the existing import block (after the `normalizeCdNome` import):

```typescript
import type { DisponibilidadeCD, FrotaManutencaoDisponibilidade, PontoAtencao } from "@/lib/repos/disponibilidade";
```

- [ ] **Step 2: Add helper functions**

Add near the other small formatting helpers (after `maintenanceType`, before `row`):

```typescript
function formatDateTimeBr(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus",
  }).format(date);
}

function mesReferencia(date: Date): string {
  const raw = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Manaus",
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function pontoSeveridadeTone(severidade: "ATENCAO" | "CRITICO"): { bg: string; color: string; border: string } {
  return severidade === "CRITICO"
    ? { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" }
    : { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
}

const PENDENTE_TONE = { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
```

- [ ] **Step 3: Add `renderDisponibilidadeEmail`**

Add near the end of the file, after `renderRelatorioOperacionalDiario` (before `SocorroNotificationInput`):

```typescript
export type DisponibilidadeEmailInput = {
  resumo: DisponibilidadeCD;
  manutencoes: FrotaManutencaoDisponibilidade[];
  pontos: PontoAtencao[];
};

export function renderDisponibilidadeEmail(
  input: DisponibilidadeEmailInput,
  dataRef: Date,
  options: ReportOptions = {}
): string {
  const { resumo, manutencoes, pontos } = input;

  const manutencaoLinhas = manutencoes
    .map((f, index) => {
      const bg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background:${bg};">
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:${INK};">${display(f.frota_geral ?? f.id)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${display(f.placa)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${display(f.cd_nome)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${display(f.setor)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${display(f.tipo)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:${MUTED};font-size:12px;max-width:260px;">${display(f.motivo)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${badge(f.status, PENDENTE_TONE)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${display(dateDisplay(f.data_envio))}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${display(dateDisplay(f.previsao_retorno))}</td>
      </tr>`;
    })
    .join("");
  const manutencaoCorpo =
    manutencaoLinhas ||
    `<tr><td colspan="9" style="padding:14px 12px;color:${MUTED};font-size:13px;text-align:center;">Nenhuma frota em manutenção neste CD.</td></tr>`;

  const pontosLinhas = pontos
    .map((p, index) => {
      const bg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background:${bg};">
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${badge(p.severidade, pontoSeveridadeTone(p.severidade))}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:${INK};">${display(p.placa ?? p.frota_geral ?? p.frota_id)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${display(p.titulo)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:${MUTED};font-size:12px;">${display(p.descricao)}</td>
      </tr>`;
    })
    .join("");
  const pontosCorpo =
    pontosLinhas ||
    `<tr><td colspan="4" style="padding:14px 12px;color:${MUTED};font-size:13px;text-align:center;">Nenhum ponto de atenção automático para este CD.</td></tr>`;

  return shell(`
    ${header(
      "Disponibilidade de Frotas",
      `Unidade: ${resumo.cd_nome} · Referência: ${mesReferencia(dataRef)} · Gerado em ${formatDateTimeBr(dataRef)}`,
      options
    )}
    <tr>
      <td style="background:#ffffff;border:1px solid ${BORDER};border-top:0;padding:22px 24px 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 -6px 18px;">
          <tr>
            ${summaryCell("Total de veículos", formatNumber(resumo.total), BLUE, undefined, 25)}
            ${summaryCell("Disponíveis", formatNumber(resumo.disponiveis), "#059669", undefined, 25)}
            ${summaryCell("Em manutenção", formatNumber(resumo.em_manutencao), "#ea580c", undefined, 25)}
            ${summaryCell("Taxa de disponibilidade", `${resumo.percentual_disponibilidade}%`, "#2563eb", undefined, 25)}
          </tr>
        </table>
        <div style="font-size:14px;font-weight:800;color:${INK};margin:4px 0 10px;">Veículos em manutenção</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
          <thead><tr style="background:${BLUE};color:#ffffff;">
            <th style="padding:10px 8px;text-align:left;">Frota</th>
            <th style="padding:10px 8px;text-align:left;">Placa</th>
            <th style="padding:10px 8px;text-align:left;">Unidade</th>
            <th style="padding:10px 8px;text-align:left;">Setor</th>
            <th style="padding:10px 8px;text-align:left;">Tipo OS</th>
            <th style="padding:10px 8px;text-align:left;">Descrição</th>
            <th style="padding:10px 8px;text-align:left;">Status</th>
            <th style="padding:10px 8px;text-align:left;">Início</th>
            <th style="padding:10px 8px;text-align:left;">Prev. saída</th>
          </tr></thead>
          <tbody>${manutencaoCorpo}</tbody>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-bottom:1px solid ${BORDER};border-radius:0 0 14px 14px;padding:0 24px 24px;">
        <div style="font-size:14px;font-weight:800;color:${INK};margin:16px 0 10px;">Pontos de atenção</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
          <thead><tr style="background:${BLUE};color:#ffffff;">
            <th style="padding:10px 8px;text-align:left;">Severidade</th>
            <th style="padding:10px 8px;text-align:left;">Frota</th>
            <th style="padding:10px 8px;text-align:left;">Ponto</th>
            <th style="padding:10px 8px;text-align:left;">Descrição</th>
          </tr></thead>
          <tbody>${pontosCorpo}</tbody>
        </table>
      </td>
    </tr>`);
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors. (`dateDisplay` is already defined earlier in the file and still used by `renderRelatorioGeral` at this point, so no unused-function warning yet.)

- [ ] **Step 5: Commit**

```bash
git add lib/email-templates.ts
git commit -m "feat: adiciona template de e-mail unificado de disponibilidade de frotas"
```

---

### Task 3: Shared logo constant + `sendDisponibilidadeEmail` in `lib/email.ts`

**Files:**
- Create: `lib/email-constants.ts`
- Modify: `lib/email.ts`

**Interfaces:**
- Produces: `export const EMAIL_LOGO_URL: string` (in `lib/email-constants.ts`). `export async function sendDisponibilidadeEmail(args: { destinatarios: string[]; resumo: DisponibilidadeCD; manutencoes: FrotaManutencaoDisponibilidade[]; pontos: PontoAtencao[]; enviadoPor: string; cdNome?: string }): Promise<SendResult>` (in `lib/email.ts`).

- [ ] **Step 1: Create `lib/email-constants.ts`**

```typescript
// Outlook (motor Word) renderiza mal imagens embutidas via cid/attachment — usamos URL publica hospedada.
// Hospedada no Supabase Storage (bucket "email-assets", publico) em vez do dominio *.azurewebsites.net:
// o filtro anti-phishing do Microsoft 365 (Defender/Safe Links) bloqueia silenciosamente imagens
// vindas de dominios genericos de PaaS (azurewebsites.net, herokuapp.com, etc.).
export const EMAIL_LOGO_URL =
  "https://nwoqastjgkgsifmxdqwp.supabase.co/storage/v1/object/public/email-assets/bemol-manutencao-logo-email.png";
```

- [ ] **Step 2: Update `lib/email.ts` to use the shared constant**

Replace the local `EMAIL_LOGO_URL` definition (lines 20-26) with an import. Change:

```typescript
const FROM = getEmailFrom();
// Outlook (motor Word) renderiza mal imagens embutidas via cid/attachment — usamos URL publica hospedada.
// Hospedada no Supabase Storage (bucket "email-assets", publico) em vez do dominio *.azurewebsites.net:
// o filtro anti-phishing do Microsoft 365 (Defender/Safe Links) bloqueia silenciosamente imagens
// vindas de dominios genericos de PaaS (azurewebsites.net, herokuapp.com, etc.).
const EMAIL_LOGO_URL =
  "https://nwoqastjgkgsifmxdqwp.supabase.co/storage/v1/object/public/email-assets/bemol-manutencao-logo-email.png";
```

to:

```typescript
const FROM = getEmailFrom();
```

And add to the top imports:

```typescript
import { EMAIL_LOGO_URL } from "@/lib/email-constants";
```

- [ ] **Step 3: Add `sendDisponibilidadeEmail`, keep `sendRelatorioGeral` for now**

In `lib/email.ts`, add to the imports from `@/lib/email-templates`:

```typescript
import {
  renderDisponibilidadeEmail,
  renderRelatorioGeral,
  renderRelatorioIndividual,
  renderRelatorioOperacionalDiario,
  renderRelatorioPainelExecutivo,
  renderSinistroNotification,
  renderSocorroNotification,
  type DashboardReportInput,
  type DisponibilidadeEmailInput,
  type RelatorioOperacionalDiarioInput,
  type SinistroNotificationInput,
  type SocorroNotificationInput,
} from "@/lib/email-templates";
```

Add a new function right after `sendRelatorioGeral` (do not delete `sendRelatorioGeral` yet — Task 5/6 still call it):

```typescript
export async function sendDisponibilidadeEmail(
  args: DisponibilidadeEmailInput & {
    destinatarios: string[];
    enviadoPor: string;
    cdNome?: string;
  }
): Promise<SendResult> {
  const sentAt = new Date();
  const cdLabel = args.cdNome ? ` — ${args.cdNome}` : "";
  const assunto = `Disponibilidade de frotas${cdLabel} - ${formatReportDate(sentAt)}`;
  const html = renderDisponibilidadeEmail(
    { resumo: args.resumo, manutencoes: args.manutencoes, pontos: args.pontos },
    sentAt,
    { logoImageSrc: EMAIL_LOGO_URL, cdNome: args.cdNome }
  );
  const destinatarios = args.destinatarios.join(",");

  try {
    await mailClient().send({
      from: FROM,
      to: args.destinatarios,
      subject: assunto,
      html,
    });
    await safeLogEmail({
      tipo: "disponibilidade_cd",
      destinatarios,
      assunto,
      enviadoPor: args.enviadoPor,
      status: "enviado",
    });
    return { ok: true };
  } catch (e) {
    const msg = sendGridErrorMessage(e);
    console.error("Erro no envio do relatório de disponibilidade", msg);
    await safeLogEmail({
      tipo: "disponibilidade_cd",
      destinatarios,
      assunto,
      enviadoPor: args.enviadoPor,
      status: "erro",
      erroMsg: msg,
    });
    return { ok: false, error: publicEmailErrorMessage(msg) };
  }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/email-constants.ts lib/email.ts
git commit -m "feat: adiciona sendDisponibilidadeEmail usando o template unificado"
```

---

### Task 4: Rewire the scheduled sender (cron) to the new template

**Files:**
- Modify: `lib/services/scheduled-report-senders.ts`

**Interfaces:**
- Consumes: `asCdResumo`, `resumoTexto` from `@/lib/repos/disponibilidade` (Task 1). `renderDisponibilidadeEmail` from `@/lib/email-templates` (Task 2). `EMAIL_LOGO_URL` from `@/lib/email-constants` (Task 3).
- Produces: `buildDisponibilidadeEmail(cdNome: string, generatedAt: Date): Promise<{ html: string; resumo: string }>` — **signature unchanged**, so `app/api/email/send-scheduled/route.ts` needs no changes.

- [ ] **Step 1: Replace the function body**

In `lib/services/scheduled-report-senders.ts`, remove the local `asCdResumo` and `resumoTexto` functions (lines 44-50) and update imports:

```typescript
import {
  getDisponibilidadeResumo,
  getPontosAtencao,
  listFrotasEmManutencao,
  asCdResumo,
  resumoTexto,
} from "@/lib/repos/disponibilidade";
import { renderDisponibilidadeEmail } from "@/lib/email-templates";
import { EMAIL_LOGO_URL } from "@/lib/email-constants";
```

(Remove the now-unused `DisponibilidadeCD`/`DisponibilidadeGeral` type-only import if nothing else in the file uses them — check with a search first; `resumoTexto`'s old local definition used `DisponibilidadeCD` as a parameter type, but that function is deleted from this file now.)

Replace the entire `buildDisponibilidadeEmail` function body (from `export async function buildDisponibilidadeEmail` through its closing `}`, currently spanning the inline HTML/CSS block) with:

```typescript
export async function buildDisponibilidadeEmail(cdNome: string, generatedAt: Date): Promise<{ html: string; resumo: string }> {
  const [resumoRaw, manutencoes, pontos] = await Promise.all([
    getDisponibilidadeResumo(cdNome),
    listFrotasEmManutencao(cdNome, 80),
    getPontosAtencao(30, cdNome),
  ]);
  const resumo = asCdResumo(resumoRaw, cdNome);
  const resumoCurto = resumoTexto(resumo);

  const html = renderDisponibilidadeEmail(
    { resumo, manutencoes, pontos },
    generatedAt,
    { logoImageSrc: EMAIL_LOGO_URL, cdNome }
  );

  return { html, resumo: resumoCurto };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors. If `esc`/`formatDateTime` show as unused, leave them — confirm with a search (`grep -n "esc(\|formatDateTime(" lib/services/scheduled-report-senders.ts`) that `buildTable`/`buildOperationalEmail`/`buildRelatorioDiarioIaEmail` further down the file still use them before assuming they're dead.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass (this function has no direct unit test — it's exercised indirectly via the manual verification in Task 7).

- [ ] **Step 4: Commit**

```bash
git add lib/services/scheduled-report-senders.ts
git commit -m "refactor: buildDisponibilidadeEmail passa a usar o template unificado"
```

---

### Task 5: Rewire the manual send action on `/frotas/disponibilidades`

**Files:**
- Modify: `app/(app)/frotas/disponibilidades/_actions.ts`

**Interfaces:**
- Consumes: `getDisponibilidadeResumo`, `listFrotasEmManutencao`, `getPontosAtencao`, `asCdResumo` from `@/lib/repos/disponibilidade`. `sendDisponibilidadeEmail` from `@/lib/email` (Task 3).

- [ ] **Step 1: Replace the data fetch and send call**

In `app/(app)/frotas/disponibilidades/_actions.ts`, remove:

```typescript
import { listFrotasForReport } from "@/lib/repos/frotas";
import { sendRelatorioGeral } from "@/lib/email";
```

Add:

```typescript
import {
  getDisponibilidadeResumo,
  getPontosAtencao,
  listFrotasEmManutencao,
  asCdResumo,
} from "@/lib/repos/disponibilidade";
import { sendDisponibilidadeEmail } from "@/lib/email";
```

Replace the body of `enviarRelatorioDisponibilidadeCDAction` (currently lines 38-39):

```typescript
    const frotas = await listFrotasForReport(cdNome ? { cd: cdNome } : {});
    const result = await sendRelatorioGeral({ destinatarios, frotas, enviadoPor: user.email, cdNome });
```

with:

```typescript
    const [resumoRaw, manutencoes, pontos] = await Promise.all([
      getDisponibilidadeResumo(cdNome),
      listFrotasEmManutencao(cdNome, 80),
      getPontosAtencao(30, cdNome),
    ]);
    const resumo = asCdResumo(resumoRaw, cdNome ?? "Todos os CDs");
    const result = await sendDisponibilidadeEmail({
      destinatarios,
      resumo,
      manutencoes,
      pontos,
      enviadoPor: user.email,
      cdNome,
    });
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/frotas/disponibilidades/_actions.ts"
git commit -m "refactor: envio manual de disponibilidade por CD usa o template unificado"
```

---

### Task 6: Rewire the manual send action on `/frotas` (all CDs, no filter)

**Files:**
- Modify: `app/(app)/frotas/_actions.ts`

**Interfaces:**
- Consumes: `getDisponibilidadeGeral`, `listFrotasEmManutencao`, `getPontosAtencao`, `asCdResumo` from `@/lib/repos/disponibilidade`. `sendDisponibilidadeEmail` from `@/lib/email`.

- [ ] **Step 1: Replace the data fetch and send call**

In `app/(app)/frotas/_actions.ts`, change the import line:

```typescript
import { createFrota, getFrota, listFrotasForReport, softDeleteFrota, updateFrota } from "@/lib/repos/frotas";
```

to (drop `listFrotasForReport` — confirm first with `grep -n "listFrotasForReport" "app/(app)/frotas/_actions.ts"` that line 227 is its only remaining use):

```typescript
import { createFrota, getFrota, softDeleteFrota, updateFrota } from "@/lib/repos/frotas";
```

Add:

```typescript
import { getDisponibilidadeGeral, getPontosAtencao, listFrotasEmManutencao, asCdResumo } from "@/lib/repos/disponibilidade";
```

Update the `sendRelatorioGeral, sendRelatorioIndividual, sendRelatorioPainelExecutivo` import from `@/lib/email` to:

```typescript
import { sendDisponibilidadeEmail, sendRelatorioIndividual, sendRelatorioPainelExecutivo } from "@/lib/email";
```

Replace `enviarRelatorioGeralAction`'s body (currently lines 223-234):

```typescript
export async function enviarRelatorioGeralAction(formData: FormData): Promise<RelatorioActionResult> {
  try {
    const email = await requireUser();
    const destinatarios = parseDestinatarios(formData);
    const frotas = await listFrotasForReport();
    const result = await sendRelatorioGeral({ destinatarios, frotas, enviadoPor: email });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (error) {
    console.error("Erro ao enviar relatório geral", error);
    return { ok: false, error: actionErrorMessage(error) };
  }
}
```

with:

```typescript
export async function enviarRelatorioGeralAction(formData: FormData): Promise<RelatorioActionResult> {
  try {
    const email = await requireUser();
    const destinatarios = parseDestinatarios(formData);
    const [resumoRaw, manutencoes, pontos] = await Promise.all([
      getDisponibilidadeGeral(),
      listFrotasEmManutencao(undefined, 80),
      getPontosAtencao(30, undefined),
    ]);
    const resumo = asCdResumo(resumoRaw, "Todos os CDs");
    const result = await sendDisponibilidadeEmail({ destinatarios, resumo, manutencoes, pontos, enviadoPor: email });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (error) {
    console.error("Erro ao enviar relatório geral", error);
    return { ok: false, error: actionErrorMessage(error) };
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/frotas/_actions.ts"
git commit -m "refactor: envio manual de disponibilidade geral usa o template unificado"
```

---

### Task 7: Delete the now-dead old renderers and confirm nothing else references them

**Files:**
- Modify: `lib/email-templates.ts`
- Modify: `lib/email.ts`

**Interfaces:**
- Removes: `renderRelatorioGeral` (from `lib/email-templates.ts`), `sendRelatorioGeral` (from `lib/email.ts`).

- [ ] **Step 1: Confirm no remaining callers**

Run: `grep -rn "renderRelatorioGeral\|sendRelatorioGeral" --include="*.ts" --include="*.tsx" .`
Expected: only the definitions themselves (no call sites left — Tasks 5 and 6 covered the only two).

- [ ] **Step 2: Delete `renderRelatorioGeral` from `lib/email-templates.ts`**

Delete the full function (from `export function renderRelatorioGeral(frotas: Frota[], dataRef: Date, options: ReportOptions = {}): string {` through its closing `}`, currently lines 254-356).

Remove now-unused pieces this leaves behind — check each with a grep across the file before removing:
- `cadastroIncompleto` import from `@/lib/frota-derived` (only used inside the deleted function).
- `maintenanceType` local function (only used inside the deleted function; `dateDisplay` stays — it's now used by `renderDisponibilidadeEmail`).

- [ ] **Step 3: Delete `sendRelatorioGeral` from `lib/email.ts`**

Delete the full function (from `export async function sendRelatorioGeral(args: {` through its closing `}`, currently lines 75-118). Remove the now-unused `renderRelatorioGeral` entry from the `@/lib/email-templates` import list, and the now-unused `Frota` type import from `@/lib/repos/frotas` if nothing else in the file uses it (check with a grep first — `sendRelatorioIndividual` likely still needs it).

- [ ] **Step 4: Type-check and full test run**

Run: `npx tsc --noEmit -p .`
Expected: no errors, no unused-import warnings.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/email-templates.ts lib/email.ts
git commit -m "refactor: remove os templates de disponibilidade divergentes"
```

---

### Task 8: Update the web page table to the same 9 columns

**Files:**
- Modify: `app/(app)/frotas/disponibilidades/page.tsx`

**Interfaces:**
- Consumes: `FrotaManutencaoDisponibilidade` rows from `listFrotasEmManutencao` (now include `setor: string | null` and `status: "PENDENTE"` from Task 1) — the `manutencoes` variable already populated in this page, no data-fetching change needed here.

- [ ] **Step 1: Replace the table header and rows**

In `app/(app)/frotas/disponibilidades/page.tsx`, replace the `<TableHeader>` block (currently lines 205-217):

```tsx
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>CD</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Envio</TableHead>
                    <TableHead className="text-right">Tempo parado</TableHead>
                    <TableHead>Local atual</TableHead>
                    <TableHead>Responsavel</TableHead>
                    <TableHead className="text-right">Atalho</TableHead>
                  </TableRow>
                </TableHeader>
```

with:

```tsx
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Frota</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Tipo OS</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Prev. saída</TableHead>
                  </TableRow>
                </TableHeader>
```

Replace the row body (currently lines 219-248):

```tsx
                  {manutencoes.map((frota) => (
                    <TableRow key={frota.id} className="group transition-colors hover:bg-blue-50/50">
                      <TableCell>
                        <Link
                          href={`/frotas/${frota.id}`}
                          className="inline-flex items-center gap-1.5 font-mono font-semibold text-blue-700 hover:underline"
                          title="Abrir visão 360 da frota"
                        >
                          {frota.placa ?? frota.frota_geral ?? `#${frota.id}`}
                          <ExternalLink className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
                        </Link>
                      </TableCell>
                      <TableCell>{frota.modelo ?? "-"}</TableCell>
                      <TableCell>{frota.cd_nome}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={frota.motivo ?? undefined}>
                        {frota.motivo ?? frota.tipo ?? "-"}
                      </TableCell>
                      <TableCell>{formatDate(frota.data_envio)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {frota.tempo_parado_dias != null ? `${frota.tempo_parado_dias} dia(s)` : "-"}
                      </TableCell>
                      <TableCell>{frota.local_atual ?? "-"}</TableCell>
                      <TableCell>{frota.responsavel ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/frotas/${frota.id}`}>Ver 360</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
```

with:

```tsx
                  {manutencoes.map((frota) => (
                    <TableRow key={frota.id} className="group transition-colors hover:bg-blue-50/50">
                      <TableCell>
                        <Link
                          href={`/frotas/${frota.id}`}
                          className="inline-flex items-center gap-1.5 font-mono font-semibold text-blue-700 hover:underline"
                          title="Abrir visão 360 da frota"
                        >
                          {frota.frota_geral ?? `#${frota.id}`}
                          <ExternalLink className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
                        </Link>
                      </TableCell>
                      <TableCell>{frota.placa ?? "-"}</TableCell>
                      <TableCell>{frota.cd_nome}</TableCell>
                      <TableCell>{frota.setor ?? "-"}</TableCell>
                      <TableCell>{frota.tipo ?? "-"}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={frota.motivo ?? undefined}>
                        {frota.motivo ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                          {frota.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(frota.data_envio)}</TableCell>
                      <TableCell>{formatDate(frota.previsao_retorno)}</TableCell>
                    </TableRow>
                  ))}
```

Note: `frota.modelo`, `frota.local_atual`, `frota.responsavel`, `frota.tempo_parado_dias` are no longer shown in this table — they're still returned by `listFrotasEmManutencao` (unchanged), just not rendered here, matching the reference design. If `Button` becomes unused elsewhere in the file after this edit, confirm with `grep -n "<Button" "app/(app)/frotas/disponibilidades/page.tsx"` before removing its import — the page has other buttons (schedule management, dialogs) so it almost certainly stays.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/frotas/disponibilidades/page.tsx"
git commit -m "feat: tabela de frotas em manutenção segue o novo layout (Setor, Tipo OS, Status)"
```

---

### Task 9: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all tests pass (existing 151+ plus the new ones from Task 1).

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Manual send — scheduled-style path (a real CD)**

Same technique used earlier in this session for the checklist report: write a throwaway `scripts/test-disponibilidade-email.ts` that imports `buildDisponibilidadeEmail` from `@/lib/services/scheduled-report-senders` and `listCDsDisponibilidade` from `@/lib/repos/disponibilidade`, calls `buildDisponibilidadeEmail(cdNome, new Date())` for one real CD (e.g. "CD Manaus"), and either prints the HTML length/a snippet or (if the user wants a real inbox check) sends it via `getSgMail()` to `gustavoandrade@bemol.com.br` the same way the checklist report was manually verified. Requires the same local `node_modules/server-only` stub used earlier in this session (create it, run with `npx tsx`, delete both the stub and the script afterward — do not commit either).

Expected: HTML renders the 4 KPI cards, the "Veículos em manutenção" table with all 9 columns populated (Setor should show a real value for every row, never blank, given Task 1's fallback), and the "Pontos de atenção" table.

- [ ] **Step 4: Manual send — general path (no CD filter)**

Optionally repeat Step 3 calling the equivalent of `enviarRelatorioGeralAction`'s data-fetch (`getDisponibilidadeGeral()` + `listFrotasEmManutencao(undefined, 80)` + `getPontosAtencao(30, undefined)` + `asCdResumo(..., "Todos os CDs")` + `renderDisponibilidadeEmail`) to confirm the "Todos os CDs" case renders correctly (header shows "Unidade: Todos os CDs", no CD badge since `cdNome` is undefined).

- [ ] **Step 5: Visual check of the web page**

Run `npm run dev`, open `/frotas/disponibilidades`, and visually confirm the "Frotas em manutenção" table shows Frota, Placa, Unidade, Setor, Tipo OS, Descrição, Status ("PENDENTE" badge), Início, Prev. saída — compare side-by-side against the two reference screenshots the user provided.

- [ ] **Step 6: Report back to the user**

Summarize: what changed, that both e-mail paths (scheduled + manual, both CD-scoped and "todos os CDs") and the web page now share one column set, and ask the user to confirm the visual result before considering the work done.
