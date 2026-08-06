# Admin de E-mails: Editar, Campos Condicionais e Disparo Manual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins edit an existing email schedule (not just create/delete), hide "Dia da semana"/"Dia do mês" fields unless relevant to the chosen frequency, and manually trigger an immediate send for any schedule without disturbing its automatic timing.

**Architecture:** Extract the email-building logic already embedded in `app/api/email/send-scheduled/route.ts` and `app/api/relatorios/daily/route.ts` into a shared, reusable module (`lib/services/scheduled-report-senders.ts`) with zero behavior change to the existing crons. Add `getEmailSchedule`/`updateEmailSchedule` to the repo layer. Add two new server actions (`updateScheduleAction`, `triggerScheduleNowAction`) and extract the schedule form into a small client component that conditionally shows/hides two fields based on the selected frequency.

**Tech Stack:** Next.js App Router (server actions, server components + one small client component), Supabase (`@supabase/supabase-js`, no ORM), SendGrid (`@sendgrid/mail`), Zod, Vitest.

## Global Constraints

- Manual trigger sends immediately using that specific schedule's current `destinatarios`/`tipo`/`cds_incluidos`, regardless of whether it's currently due.
- Manual trigger must NOT call `completeEmailSchedule`, `releaseEmailScheduleClaim`, or `claimDueEmailSchedules` — it never touches `ultimo_envio`, `proximo_envio`, or `processing_token`. It is a parallel, stateless action.
- Editing replaces the whole schedule row (same validation as create), not a partial patch of individual fields.
- "Dia da semana" is visible only when `frequencia === "SEMANAL"`; "Dia do mês" is visible only when `frequencia === "MENSAL"`. Applies to both the create and edit forms.
- Extracting `buildDisponibilidadeEmail`/`buildOperationalEmail`/`buildTable` (from `send-scheduled/route.ts`) and the daily-IA report builder (from `daily/route.ts`) into the shared module must not change their behavior — same inputs, same outputs, same HTML.
- All destinatários in schedules must remain restricted to the corporate email domain (existing Zod refine in `ScheduleSchema` — do not weaken it).

---

### Task 1: Repo layer — read and update a single schedule

**Files:**
- Modify: `lib/repos/email-schedule.ts`

**Interfaces:**
- Consumes: `EmailSchedule` type (already defined in this file), `nextScheduleRun` from `@/lib/schedule-date` (already imported in this file), `supabaseManutencao` (already imported).
- Produces:
  - `export async function getEmailSchedule(id: number): Promise<EmailSchedule | null>`
  - `export async function updateEmailSchedule(id: number, input: Pick<EmailSchedule, "nome" | "tipo" | "destinatarios" | "frequencia" | "dia_semana" | "dia_mes" | "hora_envio" | "cds_incluidos" | "ativo">): Promise<void>`

- [ ] **Step 1: Add `getEmailSchedule`**

Add to `lib/repos/email-schedule.ts`, after `listEmailSchedules`:

```typescript
export async function getEmailSchedule(id: number): Promise<EmailSchedule | null> {
  const { data, error } = await supabaseManutencao
    .from("email_schedules")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getEmailSchedule: ${error.message}`);
  return (data ?? null) as EmailSchedule | null;
}
```

- [ ] **Step 2: Add `updateEmailSchedule`**

Add to `lib/repos/email-schedule.ts`, after `createEmailSchedule`:

```typescript
export async function updateEmailSchedule(
  id: number,
  input: Pick<
    EmailSchedule,
    "nome" | "tipo" | "destinatarios" | "frequencia" | "dia_semana" | "dia_mes" | "hora_envio" | "cds_incluidos" | "ativo"
  >
): Promise<void> {
  const { error } = await supabaseManutencao
    .from("email_schedules")
    .update({
      ...input,
      atualizado_em: new Date().toISOString(),
      proximo_envio: input.ativo ? nextScheduleRun(input, new Date()).toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(`updateEmailSchedule: ${error.message}`);
}
```

Note: `proximo_envio` is set to `null` when the edited schedule is saved as inactive (`ativo: false`), matching the existing invariant enforced by `claim_email_schedules` (`where ativo = true and proximo_envio is not null`) and by `toggleEmailSchedule`, which only recomputes `proximo_envio` when activating.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/repos/email-schedule.ts
git commit -m "feat(email-schedule): add getEmailSchedule and updateEmailSchedule"
```

---

### Task 2: Extract `buildDisponibilidadeEmail`/`buildOperationalEmail` into a shared module

**Files:**
- Create: `lib/services/scheduled-report-senders.ts`
- Test: `lib/services/scheduled-report-senders.test.ts` (new)
- Modify: `app/api/email/send-scheduled/route.ts`

**Interfaces:**
- Consumes (moved as-is, no logic changes): `getDisponibilidadeResumo`, `getPontosAtencao`, `listCDsDisponibilidade`, `listFrotasEmManutencao`, `DisponibilidadeCD`, `DisponibilidadeGeral` (from `@/lib/repos/disponibilidade`); `getLavagem`, `getManutencao`, `getParadas` (from `@/lib/repos/planejamento`); `getCustosPorPeriodo` (from `@/lib/repos/custos`); `listAlertasAbertos` (from `@/lib/repos/alertas`); `listTacografoPorFrota` (from `@/lib/repos/tacografo`).
- Produces:
  - `export async function getSgMail(): Promise<typeof import("@sendgrid/mail").default>`
  - `export async function buildDisponibilidadeEmail(cdNome: string, generatedAt: Date): Promise<{ html: string; resumo: string }>`
  - `export async function buildOperationalEmail(tipo: string, generatedAt: Date): Promise<{ html: string; resumo: string }>`

This is a pure move (copy-paste + re-export), not a rewrite. `esc`, `formatDateTime`, `asCdResumo`, `resumoTexto`, `buildTable`, `ReportRow` move with the functions as private (non-exported) helpers in the new file.

- [ ] **Step 1: Write the failing test for `buildTable` (the one pure, easily-testable piece)**

Create `lib/services/scheduled-report-senders.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildOperationalEmail } from "@/lib/services/scheduled-report-senders";

// buildTable itself is not exported (it's an internal helper of buildOperationalEmail),
// so we exercise it indirectly through a tipo that has no external dependencies we'd
// need to mock in a pure unit test context is not feasible here (all six tipos hit
// Supabase-backed repos). Instead this suite documents the module's public shape.
describe("scheduled-report-senders module shape", () => {
  it("exports buildOperationalEmail as an async function", () => {
    expect(typeof buildOperationalEmail).toBe("function");
  });

  it("rejects an unsupported tipo with a clear error", async () => {
    await expect(buildOperationalEmail("TIPO_INEXISTENTE", new Date())).rejects.toThrow(
      /Tipo de agenda não suportado/
    );
  });
});
```

Note: unlike the previous plan's `lib/repos/relatorios.ts` work, this module's functions all call Supabase-backed repos internally with no pure/impure split, so meaningful unit coverage is limited to the one branch that needs no I/O (the unsupported-tipo error path). Do not attempt to mock Supabase for this task — follow the same reasoning as the prior plan: this codebase has no established Supabase-mocking convention, and forcing one caused problems before.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/services/scheduled-report-senders.test.ts`
Expected: FAIL — the module `@/lib/services/scheduled-report-senders` doesn't exist yet.

- [ ] **Step 3: Create the module by moving code out of `send-scheduled/route.ts`**

Create `lib/services/scheduled-report-senders.ts` with this exact content (copied verbatim from the current `app/api/email/send-scheduled/route.ts`, lines defining `getSgMail`, `esc`, `formatDateTime`, `asCdResumo`, `resumoTexto`, `buildDisponibilidadeEmail`, `ReportRow`, `buildTable`, `buildOperationalEmail` — only the imports and `export` keywords change):

```typescript
import {
  getDisponibilidadeResumo,
  getPontosAtencao,
  listFrotasEmManutencao,
  type DisponibilidadeCD,
  type DisponibilidadeGeral,
} from "@/lib/repos/disponibilidade";
import { getLavagem, getManutencao, getParadas } from "@/lib/repos/planejamento";
import { getCustosPorPeriodo } from "@/lib/repos/custos";
import { listAlertasAbertos } from "@/lib/repos/alertas";
import { listTacografoPorFrota } from "@/lib/repos/tacografo";

export async function getSgMail() {
  const sgMail = await import("@sendgrid/mail");
  const key = process.env.SENDGRID_API_KEY?.trim();
  if (!key) throw new Error("SENDGRID_API_KEY não configurada.");
  sgMail.default.setApiKey(key);
  return sgMail.default;
}

function esc(value: string | number | null | undefined): string {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Manaus",
  }).format(date);
}

function asCdResumo(resumo: DisponibilidadeCD | DisponibilidadeGeral, cdNome: string): DisponibilidadeCD {
  return "cd_nome" in resumo ? resumo : { cd_nome: cdNome, ...resumo };
}

function resumoTexto(cd: DisponibilidadeCD): string {
  return `${cd.cd_nome}: ${cd.percentual_disponibilidade}% disponível, ${cd.disponiveis}/${cd.total} frotas disponíveis, ${cd.em_manutencao} em manutenção, ${cd.indisponiveis} indisponíveis, ${cd.pontos_atencao} ponto(s) de atenção.`;
}

export async function buildDisponibilidadeEmail(cdNome: string, generatedAt: Date): Promise<{ html: string; resumo: string }> {
  const [resumoRaw, manutencoes, pontos] = await Promise.all([
    getDisponibilidadeResumo(cdNome),
    listFrotasEmManutencao(cdNome, 80),
    getPontosAtencao(30, cdNome),
  ]);
  const resumo = asCdResumo(resumoRaw, cdNome);
  const resumoCurto = resumoTexto(resumo);

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <style>
    body { margin:0; padding:0; background:#f8fafc; color:#0f172a; font-family:Arial,sans-serif; }
    .wrap { max-width:920px; margin:0 auto; padding:24px 12px; }
    .panel { background:#fff; border:1px solid #dbe7f5; border-radius:14px; overflow:hidden; }
    .header { background:#0b3f8e; color:#fff; padding:22px 24px; }
    h1 { margin:0; font-size:22px; }
    h2 { margin:24px 0 10px; font-size:15px; color:#334155; }
    .muted { color:#64748b; font-size:12px; }
    .body { padding:22px 24px 26px; }
    .kpis { width:100%; border-collapse:separate; border-spacing:8px; margin:12px -8px; }
    .kpi { border:1px solid #e2e8f0; border-radius:10px; padding:12px; background:#f8fafc; }
    .label { color:#64748b; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
    .value { font-size:24px; font-weight:800; margin-top:2px; }
    table.data { width:100%; border-collapse:collapse; font-size:12px; }
    table.data th { text-align:left; background:#f1f5f9; padding:8px; border-bottom:1px solid #e2e8f0; }
    table.data td { padding:8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
    .badge { display:inline-block; border-radius:999px; padding:3px 8px; font-size:11px; font-weight:700; }
    .critico { background:#fee2e2; color:#991b1b; }
    .atencao { background:#fef3c7; color:#92400e; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="panel">
      <div class="header">
        <h1>Disponibilidade de Frotas - ${esc(resumo.cd_nome)}</h1>
        <div class="muted" style="color:#dbeafe;margin-top:6px;">Relatório gerado em ${esc(formatDateTime(generatedAt))}</div>
      </div>
      <div class="body">
        <p>${esc(resumoCurto)}</p>
        <table class="kpis" role="presentation">
          <tr>
            <td class="kpi"><div class="label">Total</div><div class="value">${resumo.total}</div></td>
            <td class="kpi"><div class="label">Disponíveis</div><div class="value" style="color:#047857;">${resumo.disponiveis}</div></td>
            <td class="kpi"><div class="label">Manutenção</div><div class="value" style="color:#7c3aed;">${resumo.em_manutencao}</div></td>
            <td class="kpi"><div class="label">Indisponíveis</div><div class="value" style="color:#dc2626;">${resumo.indisponiveis}</div></td>
            <td class="kpi"><div class="label">Operação</div><div class="value">${resumo.em_operacao}</div></td>
            <td class="kpi"><div class="label">Disponibilidade</div><div class="value">${resumo.percentual_disponibilidade}%</div></td>
          </tr>
        </table>

        <h2>Frotas em manutenção</h2>
        ${
          manutencoes.length === 0
            ? "<p class=\"muted\">Nenhuma frota em manutenção neste CD.</p>"
            : `<table class="data">
              <tr><th>Placa</th><th>Modelo</th><th>Motivo</th><th>Envio</th><th>Tempo parado</th><th>Local atual</th><th>Responsavel</th></tr>
              ${manutencoes
                .map(
                  (f) => `<tr>
                    <td>${esc(f.placa ?? f.frota_geral ?? f.id)}</td>
                    <td>${esc(f.modelo)}</td>
                    <td>${esc(f.motivo ?? f.tipo)}</td>
                    <td>${esc(f.data_envio ? new Date(f.data_envio).toLocaleDateString("pt-BR") : null)}</td>
                    <td>${esc(f.tempo_parado_dias != null ? `${f.tempo_parado_dias} dia(s)` : null)}</td>
                    <td>${esc(f.local_atual)}</td>
                    <td>${esc(f.responsavel)}</td>
                  </tr>`
                )
                .join("")}
            </table>`
        }

        <h2>Pontos de atenção</h2>
        ${
          pontos.length === 0
            ? "<p class=\"muted\">Nenhum ponto de atenção automático para este CD.</p>"
            : `<table class="data">
              <tr><th>Severidade</th><th>Frota</th><th>Ponto</th><th>Descricao</th></tr>
              ${pontos
                .map(
                  (p) => `<tr>
                    <td><span class="badge ${p.severidade === "CRITICO" ? "critico" : "atencao"}">${esc(p.severidade)}</span></td>
                    <td>${esc(p.placa ?? p.frota_geral ?? p.frota_id)}</td>
                    <td>${esc(p.titulo)}</td>
                    <td>${esc(p.descricao)}</td>
                  </tr>`
                )
                .join("")}
            </table>`
        }

        <p class="muted" style="margin-top:24px;">Frotas Bemol - envio automático por CD.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { html, resumo: resumoCurto };
}

type ReportRow = Record<string, string | number | null | undefined>;

function buildTable(title: string, rows: ReportRow[], generatedAt: Date): { html: string; resumo: string } {
  const visibleRows = rows.slice(0, 100);
  const columns = visibleRows.length > 0 ? Object.keys(visibleRows[0]) : [];
  const table = visibleRows.length === 0
    ? "<p>Nenhum registro encontrado para este relatório.</p>"
    : `<table style="width:100%;border-collapse:collapse;font:12px Arial,sans-serif">
        <thead><tr>${columns.map((column) => `<th style="padding:8px;text-align:left;background:#e2e8f0;border:1px solid #cbd5e1">${esc(column)}</th>`).join("")}</tr></thead>
        <tbody>${visibleRows.map((row) => `<tr>${columns.map((column) => `<td style="padding:8px;border:1px solid #e2e8f0">${esc(row[column])}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`;

  return {
    resumo: `${rows.length} registro(s) encontrado(s).`,
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head>
      <body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif">
        <main style="max-width:960px;margin:24px auto;padding:24px;background:#fff;border:1px solid #dbe7f5;border-radius:14px">
          <h1 style="font-size:22px;color:#0b3f8e">${esc(title)}</h1>
          <p style="color:#64748b">Gerado em ${esc(formatDateTime(generatedAt))}. Total: ${rows.length} registro(s).</p>
          ${table}
          ${rows.length > visibleRows.length ? `<p style="color:#64748b">Exibindo os primeiros ${visibleRows.length} registros.</p>` : ""}
        </main>
      </body></html>`,
  };
}

export async function buildOperationalEmail(tipo: string, generatedAt: Date): Promise<{ html: string; resumo: string }> {
  if (tipo === "PREVENTIVAS_ATRASO") {
    const rows = (await getManutencao()).filter((row) => row.status !== "NO_PRAZO").map((row) => ({
      Frota: row.frota_numero ?? row.equipamento,
      Placa: row.placa,
      Serviço: row.tipo_servico,
      Status: row.status,
      "Última realização": row.data_realizada,
    }));
    return buildTable("Preventivas em atraso", rows, generatedAt);
  }
  if (tipo === "LAVAGEM_PENDENTE") {
    const rows = (await getLavagem()).filter((row) => (row.atraso_dias ?? 0) > 0).map((row) => ({
      Frota: row.frota_numero ?? row.equipamento,
      Placa: row.placa,
      Setor: row.setor,
      "Dias em atraso": row.atraso_dias,
      Status: row.status,
    }));
    return buildTable("Lavagens pendentes", rows, generatedAt);
  }
  if (tipo === "TACOGRAFO_VENCIDO") {
    const rows = (await listTacografoPorFrota())
      .filter((row) => row.status !== "EM_DIA")
      .map((row) => ({
        Frota: row.frota_geral,
        Placa: row.placa,
        Local: row.localizacao,
        Status: row.status,
        Vencimento: row.data_proxima,
        "Dias para vencer": row.dias_para_vencer,
      }));
    return buildTable("Tacógrafos pendentes", rows, generatedAt);
  }
  if (tipo === "FROTAS_PARADAS") {
    const rows = (await getParadas()).map((row) => ({
      Frota: row.frota_numero,
      Placa: row.placa,
      Motivo: row.servicos ?? row.descricao_original,
      Oficina: row.oficina,
      "Previsão de saída": row.prev_saida,
      Criticidade: row.ia_criticidade,
    }));
    return buildTable("Frotas paradas", rows, generatedAt);
  }
  if (tipo === "CUSTOS") {
    const rows = (await getCustosPorPeriodo(12)).map((row) => ({
      Período: row.data_periodo,
      Ordens: row.qtd_ordens,
      "Valor total": row.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    }));
    return buildTable("Custos de manutenção", rows, generatedAt);
  }
  if (tipo === "ALERTAS") {
    const rows = (await listAlertasAbertos(100)).map((row) => ({
      Frota: row.frota_geral ?? row.frota_id,
      Placa: row.placa,
      Tipo: row.tipo,
      Título: row.titulo,
      Descrição: row.descricao,
      Criado: row.criado_em,
    }));
    return buildTable("Alertas operacionais", rows, generatedAt);
  }
  throw new Error(`Tipo de agenda não suportado neste endpoint: ${tipo}`);
}
```

- [ ] **Step 4: Update `app/api/email/send-scheduled/route.ts` to import from the new module instead of defining locally**

Remove from `app/api/email/send-scheduled/route.ts`: the `getSgMail`, `esc`, `formatDateTime`, `asCdResumo`, `resumoTexto`, `buildDisponibilidadeEmail`, `ReportRow`, `buildTable`, `buildOperationalEmail` definitions, and the now-unused imports (`getDisponibilidadeResumo`, `getPontosAtencao`, `listFrotasEmManutencao`, `DisponibilidadeCD`, `DisponibilidadeGeral`, `getLavagem`, `getManutencao`, `getParadas`, `getCustosPorPeriodo`, `listAlertasAbertos`, `listTacografoPorFrota` — keep `listCDsDisponibilidade`, which is still used directly in the route's `POST` handler).

Add this import at the top of `app/api/email/send-scheduled/route.ts`:

```typescript
import { getSgMail, buildDisponibilidadeEmail, buildOperationalEmail } from "@/lib/services/scheduled-report-senders";
```

The rest of the file (the `POST` handler) is unchanged — it already calls `getSgMail()`, `buildDisponibilidadeEmail(...)`, `buildOperationalEmail(...)` by name, so only the import source changes.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/services/scheduled-report-senders.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full suite and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/services/scheduled-report-senders.ts lib/services/scheduled-report-senders.test.ts app/api/email/send-scheduled/route.ts
git commit -m "refactor(email): extract buildDisponibilidadeEmail/buildOperationalEmail into a reusable module"
```

---

### Task 3: Extract the daily-IA report builder into the shared module

**Files:**
- Modify: `lib/services/scheduled-report-senders.ts`
- Modify: `app/api/relatorios/daily/route.ts`

**Interfaces:**
- Consumes: `getRelatorioKpis`, `getRankingFrotas` (from `@/lib/repos/relatorios`, already used in `daily/route.ts`), `listAlertasAbertos` (already imported into `scheduled-report-senders.ts` by Task 2), `listAnalisesDia` (from `@/lib/repos/analises-ia`), `getAppUrl` (from `@/lib/app-url`).
- Produces:
  - `export async function buildRelatorioDiarioIaEmail(hoje: string): Promise<{ html: string; kpis: Awaited<ReturnType<typeof getRelatorioKpis>>; alertas: Awaited<ReturnType<typeof listAlertasAbertos>>; rankingFrotas: Awaited<ReturnType<typeof getRankingFrotas>>; criticos: Awaited<ReturnType<typeof listAnalisesDia>> }>`

- [ ] **Step 1: Add the builder to `lib/services/scheduled-report-senders.ts`**

Add these imports to the top of `lib/services/scheduled-report-senders.ts` (alongside the existing ones from Task 2):

```typescript
import { getRelatorioKpis, getRankingFrotas } from "@/lib/repos/relatorios";
import { listAnalisesDia } from "@/lib/repos/analises-ia";
import { getAppUrl } from "@/lib/app-url";
```

Add this function to `lib/services/scheduled-report-senders.ts` (copied verbatim from `app/api/relatorios/daily/route.ts`'s current `buildEmailHtml` function plus its own local `esc` — reuse the `esc` already defined in this file from Task 2 instead of redefining it, since it has the identical implementation):

```typescript
export async function buildRelatorioDiarioIaEmail(hoje: string) {
  const [kpis, alertas, rankingFrotas, analises] = await Promise.all([
    getRelatorioKpis(hoje),
    listAlertasAbertos(10),
    getRankingFrotas(hoje, 5),
    listAnalisesDia(hoje),
  ]);

  const criticos = analises.filter((a) =>
    ["CRITICO", "BLOQUEIO_SUGERIDO"].includes(a.criticidade_revisada ?? a.criticidade)
  );

  const appUrl = getAppUrl();

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
body { font-family: Arial, sans-serif; color: #1e293b; background: #f8fafc; margin: 0; padding: 0; }
.container { max-width: 600px; margin: 0 auto; background: #fff; padding: 24px; }
h1 { color: #1d4ed8; font-size: 20px; }
h2 { font-size: 15px; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
.kpi-grid { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
.kpi { background: #f1f5f9; border-radius: 8px; padding: 12px 16px; min-width: 100px; }
.kpi-value { font-size: 24px; font-weight: bold; }
.kpi-label { font-size: 12px; color: #64748b; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.badge-critico { background: #fee2e2; color: #991b1b; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; padding: 8px; background: #f1f5f9; }
td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
.footer { margin-top: 32px; font-size: 12px; color: #94a3b8; }
</style></head>
<body><div class="container">
  <h1>Frotas Bemol — Relatório IA ${hoje}</h1>

  <h2>Resumo do dia</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-value">${kpis.total_checklists}</div><div class="kpi-label">Checklists</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#059669">${kpis.ok}</div><div class="kpi-label">OK</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#d97706">${kpis.atencao}</div><div class="kpi-label">Atenção</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#dc2626">${kpis.critico}</div><div class="kpi-label">Crítico</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#ea580c">${kpis.manutencao}</div><div class="kpi-label">Manutenção</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#b91c1c">${kpis.bloqueio_sugerido}</div><div class="kpi-label">Bloqueio</div></div>
  </div>

  ${criticos.length > 0 ? `
  <h2>Problemas críticos (${criticos.length})</h2>
  <table><tr><th>Frota</th><th>Criticidade</th><th>Resumo</th><th>Ação</th></tr>
  ${criticos.map((a) => `
  <tr>
    <td>${a.frota_id}</td>
    <td><span class="badge badge-critico">${escInternal((a.criticidade_revisada ?? a.criticidade).replace("_", " "))}</span></td>
    <td>${escInternal(a.resumo_ia)}</td>
    <td>${escInternal(a.acao_recomendada)}</td>
  </tr>`).join("")}
  </table>` : "<p>Nenhum problema crítico hoje.</p>"}

  ${rankingFrotas.length > 0 ? `
  <h2>Frotas com mais problemas</h2>
  <table><tr><th>Frota</th><th>Placa</th><th>Problemas</th></tr>
  ${rankingFrotas.map((f) => `<tr><td>${escInternal(f.frota_geral) !== "—" ? escInternal(f.frota_geral) : f.frota_id}</td><td>${escInternal(f.placa)}</td><td>${f.total_problemas}</td></tr>`).join("")}
  </table>` : ""}

  ${alertas.length > 0 ? `
  <h2>Alertas abertos (${alertas.length})</h2>
  <table><tr><th>Tipo</th><th>Frota</th><th>Descrição</th></tr>
  ${alertas.map((a) => `<tr><td>${escInternal(a.tipo)}</td><td>${escInternal(a.frota_geral) !== "—" ? escInternal(a.frota_geral) : a.frota_id}</td><td>${escInternal(a.descricao)}</td></tr>`).join("")}
  </table>` : ""}

  <p><a href="${appUrl}/relatorios/checklists">Ver painel completo →</a></p>

  <div class="footer">Frotas Bemol · Plataforma Operacional · ${hoje}</div>
</div></body></html>`;

  return { html, kpis, alertas, rankingFrotas, criticos };
}
```

**Important:** the original `daily/route.ts`'s local `esc` function has a DIFFERENT implementation than this file's `esc` (Task 2's `esc` returns `"-"` for null/undefined and escapes `&`, `<`, `>`, `"`; `daily/route.ts`'s `esc` returns `"—"` (em-dash) for null/undefined and only escapes `&`, `<`, `>`). Using the wrong one changes visible output. To preserve `daily/route.ts`'s exact current behavior, add a SECOND, distinctly-named private helper to `lib/services/scheduled-report-senders.ts` instead of reusing Task 2's `esc`:

```typescript
function escInternal(s: string | null | undefined): string {
  return (s ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

Place this near the top of the file alongside the other private helpers, and use `escInternal` (not `esc`) inside `buildRelatorioDiarioIaEmail`, exactly as shown in the template above.

- [ ] **Step 2: Update `app/api/relatorios/daily/route.ts` to use the extracted builder**

Replace the entire contents of `app/api/relatorios/daily/route.ts` with:

```typescript
// app/api/relatorios/daily/route.ts
import { NextRequest, NextResponse } from "next/server";
import { buildRelatorioDiarioIaEmail } from "@/lib/services/scheduled-report-senders";
import { sendRelatorioDiarioIa } from "@/lib/email";
import {
  claimDueEmailSchedules,
  completeEmailSchedule,
  releaseEmailScheduleClaim,
} from "@/lib/repos/email-schedule";

import { isInternalAuthorized } from "@/lib/internal-auth";
import { reportCalendarDate } from "@/lib/report-date";
import { apiError } from "@/lib/api-error";

export async function GET() {
  const response = apiError("Use POST para executar o envio.", 405, "METHOD_NOT_ALLOWED");
  response.headers.set("Allow", "POST");
  return response;
}

export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) return apiError("Unauthorized", 401, "INVALID_INTERNAL_TOKEN");

  const hoje = reportCalendarDate();

  const { html, alertas, criticos } = await buildRelatorioDiarioIaEmail(hoje);

  const schedules = await claimDueEmailSchedules({ limit: 25, tipo: "RELATORIO_DIARIO_IA" });

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
      aviso: "Nenhuma agenda ativa do tipo RELATORIO_DIARIO_IA. Cadastre em /administracao/emails.",
      html_preview: html.slice(0, 500),
    });
  }

  const assunto = `[Frotas] Relatório IA — ${hoje}`;
  const sendResult = await sendRelatorioDiarioIa({ destinatarios, html, assunto });

  if (sendResult.ok) {
    await Promise.all(schedules.map((schedule) => completeEmailSchedule(schedule, new Date())));
  } else {
    await Promise.all(schedules.map((schedule) => releaseEmailScheduleClaim(schedule)));
  }

  return NextResponse.json({
    data: hoje,
    total_criticos: criticos.length,
    alertas_abertos: alertas.length,
    destinatarios,
    enviado: sendResult.ok,
    erro_envio: sendResult.ok ? null : sendResult.error,
    html_preview: html.slice(0, 500),
  }, { status: sendResult.ok ? 200 : 502 });
}
```

Note this drops the `kpis` field from the JSON response (previously `getRelatorioKpis` was called separately just to include `kpis` in the response — `buildRelatorioDiarioIaEmail` already computes it internally as part of building the HTML, so it's available; if you want to preserve the exact prior response shape, destructure `kpis` too and add `kpis` back into the returned JSON: `const { html, alertas, criticos, kpis } = await buildRelatorioDiarioIaEmail(hoje);` then include `kpis,` in the final `NextResponse.json({...})` call). Use this version (with `kpis` preserved) — it matches the original endpoint's response shape exactly, which the GitHub Actions workflow's `jq` parsing does not depend on but external consumers might.

- [ ] **Step 3: Run the full suite and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 4: Commit**

```bash
git add lib/services/scheduled-report-senders.ts app/api/relatorios/daily/route.ts
git commit -m "refactor(email): extract buildRelatorioDiarioIaEmail into the shared reusable module"
```

---

### Task 4: `updateScheduleAction`

**Files:**
- Modify: `app/(app)/administracao/emails/_actions.ts`

**Interfaces:**
- Consumes: `getEmailSchedule`, `updateEmailSchedule` (Task 1, `@/lib/repos/email-schedule`); `ScheduleSchema` (already defined in this file); `requireAppUser`, `canManageEmailSchedules` (already imported); `publicActionError` (already imported).
- Produces: `export async function updateScheduleAction(formData: FormData): Promise<void>`

- [ ] **Step 1: Add the action**

Add to `app/(app)/administracao/emails/_actions.ts`, after `createScheduleAction`. The edit form (Task 6) does not expose an "ativo" toggle — pausing/activating remains the job of the existing `toggleScheduleAction` — so this action fetches the schedule's current `ativo` value first and passes it through unchanged, instead of hardcoding `true` (which would silently reactivate a paused schedule just because someone edited its name):

```typescript
export async function updateScheduleAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");

  const id = Number(formData.get("id"));

  try {
    const current = await getEmailSchedule(id);
    if (!current) throw new Error("Programação não encontrada.");

    const raw = {
      nome: formData.get("nome"),
      tipo: formData.get("tipo"),
      destinatarios: formData.get("destinatarios"),
      frequencia: formData.get("frequencia"),
      dia_semana: formData.get("dia_semana") || null,
      dia_mes: formData.get("dia_mes") || null,
      hora_envio: formData.get("hora_envio"),
      cds_incluidos: formData.get("cds_incluidos") ?? "",
    };
    const parsed = ScheduleSchema.parse(raw);
    await updateEmailSchedule(id, { ...parsed, ativo: current.ativo });
    revalidatePath("/administracao/emails");
    redirect("/administracao/emails?sucesso=Programação+atualizada");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      `/administracao/emails?erro=${encodeURIComponent(
        publicActionError(error, "Erro ao atualizar programação")
      )}`
    );
  }
}
```

- [ ] **Step 2: Add the import**

At the top of `app/(app)/administracao/emails/_actions.ts`, update the import from `@/lib/repos/email-schedule`:

```typescript
import {
  createEmailSchedule,
  getEmailSchedule,
  updateEmailSchedule,
  toggleEmailSchedule,
  deleteEmailSchedule,
} from "@/lib/repos/email-schedule";
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/administracao/emails/_actions.ts"
git commit -m "feat(admin): add updateScheduleAction for editing existing email schedules"
```

---

### Task 5: `triggerScheduleNowAction`

**Files:**
- Modify: `app/(app)/administracao/emails/_actions.ts`

**Interfaces:**
- Consumes: `getEmailSchedule` (Task 1); `getSgMail`, `buildDisponibilidadeEmail`, `buildOperationalEmail`, `buildRelatorioDiarioIaEmail` (Tasks 2–3, `@/lib/services/scheduled-report-senders`); `sendRelatorioDiarioIa`, `sendRelatorioOperacionalDiario` (`@/lib/email`); `getChecklistsRealizadosNoDia`, `getFrotasComSemChecklistNoDia`, `getPendenciasCriadasNoDiaPorFrota` (`@/lib/repos/relatorios`); `listCDsDisponibilidade` (`@/lib/repos/disponibilidade`); `logEmail` (`@/lib/repos/email-logs`); `getEmailFrom` (`@/lib/email-from`); `reportCalendarDate`, `shiftCalendarDate`, `reportDayUtcRange` (`@/lib/report-date`).
- Produces: `export async function triggerScheduleNowAction(formData: FormData): Promise<void>`

- [ ] **Step 1: Add the imports**

Add to the top of `app/(app)/administracao/emails/_actions.ts`:

```typescript
import {
  getSgMail,
  buildDisponibilidadeEmail,
  buildOperationalEmail,
  buildRelatorioDiarioIaEmail,
} from "@/lib/services/scheduled-report-senders";
import { sendRelatorioDiarioIa, sendRelatorioOperacionalDiario } from "@/lib/email";
import {
  getChecklistsRealizadosNoDia,
  getFrotasComSemChecklistNoDia,
  getPendenciasCriadasNoDiaPorFrota,
} from "@/lib/repos/relatorios";
import { listCDsDisponibilidade } from "@/lib/repos/disponibilidade";
import { logEmail } from "@/lib/repos/email-logs";
import { getEmailFrom } from "@/lib/email-from";
import { reportCalendarDate, reportDayUtcRange, shiftCalendarDate } from "@/lib/report-date";
```

- [ ] **Step 2: Add the action**

Add to `app/(app)/administracao/emails/_actions.ts`, after `updateScheduleAction`:

```typescript
export async function triggerScheduleNowAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");

  const id = Number(formData.get("id"));

  try {
    const schedule = await getEmailSchedule(id);
    if (!schedule) throw new Error("Programação não encontrada.");

    const agora = new Date();
    const fromEmail = getEmailFrom();

    if (schedule.tipo === "RELATORIO_DIARIO_IA") {
      const hoje = reportCalendarDate();
      const { html } = await buildRelatorioDiarioIaEmail(hoje);
      const assunto = `[Frotas] Relatório IA — ${hoje}`;
      const result = await sendRelatorioDiarioIa({
        destinatarios: schedule.destinatarios,
        html,
        assunto,
        enviadoPor: user.email,
      });
      if (!result.ok) throw new Error(result.error);
    } else if (schedule.tipo === "RELATORIO_OPERACIONAL_DIARIO") {
      const ontem = shiftCalendarDate(reportCalendarDate(), -1);
      const dataRef = new Date(reportDayUtcRange(ontem).start);
      const [totalChecklists, frotasChecklist, pendenciasPorFrota] = await Promise.all([
        getChecklistsRealizadosNoDia(ontem),
        getFrotasComSemChecklistNoDia(ontem),
        getPendenciasCriadasNoDiaPorFrota(ontem),
      ]);
      const totalApontamentos = pendenciasPorFrota.reduce((sum, grupo) => sum + grupo.itens.length, 0);
      const result = await sendRelatorioOperacionalDiario({
        destinatarios: schedule.destinatarios,
        dataRef,
        enviadoPor: user.email,
        input: {
          totalChecklists,
          totalApontamentos,
          frotasFizeram: frotasChecklist.fizeram,
          frotasNaoFizeram: frotasChecklist.naoFizeram,
          pendenciasPorFrota,
        },
      });
      if (!result.ok) throw new Error(result.error);
    } else if (schedule.tipo === "DISPONIBILIDADE") {
      const sgMail = await getSgMail();
      const cdsAlvo = schedule.cds_incluidos.length > 0 ? schedule.cds_incluidos : await listCDsDisponibilidade();
      const falhas: string[] = [];

      for (const cdNome of cdsAlvo) {
        const { html, resumo } = await buildDisponibilidadeEmail(cdNome, agora);
        const assunto = `[FROTAS] Disponibilidade ${cdNome} - ${agora.toLocaleDateString("pt-BR")}`;
        const destinatariosStr = schedule.destinatarios.join(",");
        try {
          await sgMail.send({ to: schedule.destinatarios, from: fromEmail, subject: assunto, html });
          await logEmail({
            tipo: "disponibilidade_cd",
            cdNome,
            destinatarios: destinatariosStr,
            assunto,
            enviadoPor: user.email,
            status: "enviado",
            resumo,
            conteudoHtml: html,
            scheduleId: schedule.id,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await logEmail({
            tipo: "disponibilidade_cd",
            cdNome,
            destinatarios: destinatariosStr,
            assunto,
            enviadoPor: user.email,
            status: "erro",
            erroMsg: message,
            resumo,
            conteudoHtml: html,
            scheduleId: schedule.id,
          });
          falhas.push(cdNome);
        }
      }
      if (falhas.length > 0) throw new Error(`Falha ao enviar para: ${falhas.join(", ")}`);
    } else {
      const sgMail = await getSgMail();
      const { html: corpo, resumo } = await buildOperationalEmail(schedule.tipo, agora);
      const assunto = `[FROTAS] ${schedule.nome} - ${agora.toLocaleDateString("pt-BR")}`;
      const destinatariosStr = schedule.destinatarios.join(",");
      try {
        await sgMail.send({ to: schedule.destinatarios, from: fromEmail, subject: assunto, html: corpo });
        await logEmail({
          tipo: schedule.tipo.toLowerCase(),
          destinatarios: destinatariosStr,
          assunto,
          enviadoPor: user.email,
          status: "enviado",
          resumo,
          conteudoHtml: corpo,
          scheduleId: schedule.id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await logEmail({
          tipo: schedule.tipo.toLowerCase(),
          destinatarios: destinatariosStr,
          assunto,
          enviadoPor: user.email,
          status: "erro",
          erroMsg: message,
          resumo,
          conteudoHtml: corpo,
          scheduleId: schedule.id,
        });
        throw err;
      }
    }

    revalidatePath("/administracao/emails");
    redirect(`/administracao/emails?sucesso=${encodeURIComponent(`"${schedule.nome}" disparada agora`)}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      `/administracao/emails?erro=${encodeURIComponent(
        publicActionError(error, "Erro ao disparar programação")
      )}`
    );
  }
}
```

Note: this action deliberately never calls `claimDueEmailSchedules`, `completeEmailSchedule`, or `releaseEmailScheduleClaim` — it reads the schedule once via `getEmailSchedule` and sends directly, leaving `ultimo_envio`/`proximo_envio`/`processing_token` untouched, per the plan's Global Constraints.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. Pay attention to the shape of `sendRelatorioOperacionalDiario`'s `input` parameter (`totalChecklists`, `totalApontamentos`, `frotasFizeram`, `frotasNaoFizeram`, `pendenciasPorFrota`) — it must match `RelatorioOperacionalDiarioInput` from `lib/email-templates.ts` exactly, and `getFrotasComSemChecklistNoDia`'s return shape (`{ fizeram, naoFizeram }`) must be accessed as shown.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/administracao/emails/_actions.ts"
git commit -m "feat(admin): add triggerScheduleNowAction for manual immediate sends"
```

---

### Task 6: `ScheduleForm` client component with conditional fields

**Files:**
- Create: `app/(app)/administracao/emails/ScheduleForm.tsx`

**Interfaces:**
- Consumes: `Button`, `Input`, `Label` from `@/components/ui/*` (already used in `page.tsx`); `EmailSchedule` type from `@/lib/repos/email-schedule`.
- Produces: `export function ScheduleForm(props: { schedule?: EmailSchedule; action: (formData: FormData) => void | Promise<void> }): JSX.Element`

- [ ] **Step 1: Create the component**

```typescript
// app/(app)/administracao/emails/ScheduleForm.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmailSchedule } from "@/lib/repos/email-schedule";

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

type ScheduleFormProps = {
  schedule?: EmailSchedule;
  action: (formData: FormData) => void | Promise<void>;
};

export function ScheduleForm({ schedule, action }: ScheduleFormProps) {
  const [frequencia, setFrequencia] = useState(schedule?.frequencia ?? "DIARIO");
  const isEdit = Boolean(schedule);

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isEdit ? "Editar programação" : "Nova programação"}</h2>
        {isEdit && (
          <a href="/administracao/emails" className="text-sm text-muted-foreground hover:underline">
            Cancelar
          </a>
        )}
      </div>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        {isEdit && <input type="hidden" name="id" value={schedule!.id} />}
        <div className="space-y-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            name="nome"
            placeholder="Ex: Relatório semanal de disponibilidade"
            defaultValue={schedule?.nome}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tipo">Tipo de relatório</Label>
          <select
            id="tipo"
            name="tipo"
            required
            defaultValue={schedule?.tipo}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {Object.entries(TIPO_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="destinatarios">Destinatários (separados por vírgula)</Label>
          <Input
            id="destinatarios"
            name="destinatarios"
            placeholder="email1@bemol.com.br, email2@bemol.com.br"
            defaultValue={schedule?.destinatarios.join(", ")}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="frequencia">Frequência</Label>
          <select
            id="frequencia"
            name="frequencia"
            value={frequencia}
            onChange={(e) => setFrequencia(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="DIARIO">Diário</option>
            <option value="SEMANAL">Semanal</option>
            <option value="QUINZENAL">Quinzenal</option>
            <option value="MENSAL">Mensal</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hora_envio">Horário</Label>
          <Input
            id="hora_envio"
            name="hora_envio"
            type="time"
            defaultValue={schedule?.hora_envio?.slice(0, 5) ?? "07:00"}
            required
          />
        </div>
        {frequencia === "SEMANAL" && (
          <div className="space-y-1.5">
            <Label htmlFor="dia_semana">Dia da semana</Label>
            <select
              id="dia_semana"
              name="dia_semana"
              defaultValue={String(schedule?.dia_semana ?? 1)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="0">Domingo</option><option value="1">Segunda-feira</option><option value="2">Terça-feira</option>
              <option value="3">Quarta-feira</option><option value="4">Quinta-feira</option><option value="5">Sexta-feira</option><option value="6">Sábado</option>
            </select>
          </div>
        )}
        {frequencia === "MENSAL" && (
          <div className="space-y-1.5">
            <Label htmlFor="dia_mes">Dia do mês</Label>
            <Input
              id="dia_mes"
              name="dia_mes"
              type="number"
              min={1}
              max={31}
              defaultValue={schedule?.dia_mes ?? 1}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="cds_incluidos">CDs incluídos (vazio = todos)</Label>
          <Input
            id="cds_incluidos"
            name="cds_incluidos"
            placeholder="CD Manaus, CD Boa Vista"
            defaultValue={schedule?.cds_incluidos.join(", ")}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">{isEdit ? "Salvar alterações" : "Criar programação"}</Button>
        </div>
      </form>
    </div>
  );
}
```

Note: when `frequencia` is `SEMANAL` or `MENSAL` but the field is hidden by conditional rendering elsewhere (e.g. user picks `SEMANAL`, sets `dia_semana`, then switches to `DIARIO` before submitting), the hidden field's `name` attribute is absent from the DOM and thus absent from `FormData` — `formData.get("dia_semana")` returns `null` in `createScheduleAction`/`updateScheduleAction`, which the existing `raw.dia_semana = formData.get("dia_semana") || null` line already handles correctly (falls back to `null`, and `ScheduleSchema`'s `dia_semana: z.coerce.number().int().min(0).max(6).nullable()` accepts `null`). No action-layer change needed for this.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/administracao/emails/ScheduleForm.tsx"
git commit -m "feat(admin): add ScheduleForm client component with frequency-conditional fields"
```

---

### Task 7: Wire everything into `page.tsx`

**Files:**
- Modify: `app/(app)/administracao/emails/page.tsx`

**Interfaces:**
- Consumes: `ScheduleForm` (Task 6); `createScheduleAction`, `updateScheduleAction`, `toggleScheduleAction`, `deleteScheduleAction`, `triggerScheduleNowAction` (Tasks 4–5, `./_actions`); `getEmailSchedule` (Task 1, `@/lib/repos/email-schedule`).

- [ ] **Step 1: Replace the page content**

Replace `app/(app)/administracao/emails/page.tsx` in full with:

```typescript
import { FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { canManageEmailSchedules, requireAppUser } from "@/lib/rbac";
import { getEmailSchedule, listEmailSchedules } from "@/lib/repos/email-schedule";
import {
  createScheduleAction,
  updateScheduleAction,
  toggleScheduleAction,
  deleteScheduleAction,
  triggerScheduleNowAction,
} from "./_actions";
import { ScheduleForm } from "./ScheduleForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

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

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");
  const sp = await searchParams;
  const schedules = await listEmailSchedules();

  const editingId = sp.editar ? Number(sp.editar) : null;
  const editingSchedule = editingId ? await getEmailSchedule(editingId) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Programação de E-mails"
        description={`${schedules.length} programação(ões) configurada(s).`}
        icon={FileText}
        severity="INFO"
      />

      {sp.sucesso && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {sp.sucesso}
        </div>
      )}
      {sp.erro && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {sp.erro}
        </div>
      )}

      <ScheduleForm
        schedule={editingSchedule ?? undefined}
        action={editingSchedule ? updateScheduleAction : createScheduleAction}
      />

      {/* Lista */}
      <div className="space-y-3">
        {schedules.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma programação configurada ainda.</p>
        )}
        {schedules.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.nome}</span>
                <Badge variant="outline">{TIPO_LABELS[s.tipo] ?? s.tipo}</Badge>
                <Badge
                  variant="outline"
                  className={
                    s.ativo
                      ? "border-emerald-200 text-emerald-700"
                      : "border-slate-200 text-slate-500"
                  }
                >
                  {s.ativo ? "Ativo" : "Pausado"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.frequencia} · {s.hora_envio} · {s.destinatarios.length} destinatário(s)
                {s.ultimo_envio
                  ? ` · Último envio: ${new Date(s.ultimo_envio).toLocaleDateString("pt-BR")}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`/administracao/emails?editar=${s.id}`}>
                <Button type="button" variant="outline" size="sm">
                  Editar
                </Button>
              </a>
              <form action={triggerScheduleNowAction}>
                <input type="hidden" name="id" value={s.id} />
                <Button type="submit" variant="outline" size="sm">
                  Disparar agora
                </Button>
              </form>
              <form action={toggleScheduleAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="ativo" value={String(s.ativo)} />
                <Button type="submit" variant="outline" size="sm">
                  {s.ativo ? "Pausar" : "Ativar"}
                </Button>
              </form>
              <form action={deleteScheduleAction}>
                <input type="hidden" name="id" value={s.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  Remover
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Note: `TIPO_LABELS` now lives in both `page.tsx` and `ScheduleForm.tsx` (duplicated). This is intentional and matches the plan's scope — `page.tsx` needs it to render the `Badge` label per schedule in the list, and `ScheduleForm.tsx` needs it to render the `<select>` options; extracting it into a shared constant module is a reasonable follow-up but out of scope for this plan (YAGNI: two small `Record<string, string>` literals, ~9 lines each, is not worth a new file for this change).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Run the full suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/administracao/emails/page.tsx"
git commit -m "feat(admin): wire edit mode and manual trigger into the emails admin page"
```

---

### Task 8: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the 2 new tests from Task 2.

- [ ] **Step 2: Run the production build**

Run: `npm run build` (with the same CI-equivalent dummy env vars used in prior verification, since this sandboxed environment has no real Supabase/SendGrid/Azure AD credentials)
Expected: TypeScript compiles cleanly across the whole app; page-data collection may fail only on the pre-existing, unrelated `AZURE_AD_CLIENT_ID` requirement (same as previously documented) — that is not a regression from this plan.

- [ ] **Step 3: Manual UI verification (requires a running dev server with real credentials — document as follow-up if unavailable in this environment)**

1. Go to `/administracao/emails`. Confirm the create form shows "Dia da semana" only when "Frequência" = Semanal, and "Dia do mês" only when Mensal (toggle the select and watch the fields appear/disappear without a page reload).
2. Create a test schedule (any tipo, e.g. `ALERTAS`, `DIARIO`).
3. Click "Editar" on it — confirm the form pre-fills with its current values and the title changes to "Editar programação". Change the `nome` and save — confirm the list reflects the new name and `?sucesso=` shows.
4. Click "Disparar agora" on a schedule whose `hora_envio` is NOT the current time — confirm an email is sent immediately (check the recipient's inbox or `email_logs` for a new row with `schedule_id` set and `status: "enviado"`), and confirm the schedule's `ultimo_envio`/`proximo_envio` in the database did NOT change as a result.
5. Repeat step 4 for `RELATORIO_OPERACIONAL_DIARIO` and `RELATORIO_DIARIO_IA` schedule types specifically, since those use a different code path (Tasks 2–3's extraction) than the generic types.
6. Delete the test schedule(s) created for this verification.
