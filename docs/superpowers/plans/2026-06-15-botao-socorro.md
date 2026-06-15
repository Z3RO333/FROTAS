# Botão de Socorro (Help Motora) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um terceiro tipo de sinistro "Socorro / Help Motora" ao fluxo do motorista, com formulário próprio, notificação por e-mail roteada por área, e acompanhamento de status no painel admin.

**Architecture:** Reaproveita a tabela `sinistros_frota`, o storage `sinistro-media` e o cliente SendGrid já existentes. Novo tipo `"socorro"` segue um fluxo de status próprio (`ABERTO` → `EM_ATENDIMENTO`/`GUINCHO_ACIONADO` → `RESOLVIDO`/`CANCELADO`), com um formulário simplificado (`SocorroForm`) e notificação de e-mail roteada por área via env vars.

**Tech Stack:** Next.js App Router (Server Actions), Supabase (Postgres + Storage), SendGrid (`@sendgrid/mail`), Zod, TypeScript.

---

## Verification approach

Este projeto não possui suite de testes automatizados (sem `test` script no `package.json`). A verificação de cada task é feita via:
- `npx tsc --noEmit` (typecheck) — deve passar sem erros novos
- `npm run lint` — deve passar sem erros novos
- Para a migration: aplicar via Supabase CLI/MCP em ambiente de desenvolvimento (ou revisão manual do SQL, já que o projeto usa `supabase/migrations` versionadas)

---

### Task 1: Migration — novas colunas e tipo "socorro"

**Files:**
- Create: `supabase/migrations/024_socorro_frota.sql`

- [ ] **Step 1: Escrever a migration**

```sql
alter table public.sinistros_frota
  add column if not exists telefone_solicitante text,
  add column if not exists precisa_guincho boolean,
  add column if not exists responsavel_atendimento text,
  add column if not exists atendimento_concluido_em timestamptz;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'sinistros_frota_tipo_sinistro_check'
  ) then
    alter table public.sinistros_frota drop constraint sinistros_frota_tipo_sinistro_check;
  end if;

  alter table public.sinistros_frota
    add constraint sinistros_frota_tipo_sinistro_check
    check (tipo_sinistro in ('veiculo', 'casa', 'socorro'));
end $$;

create index if not exists idx_sinistros_frota_tipo_status
  on public.sinistros_frota (tipo_sinistro, status, criado_em desc);
```

- [ ] **Step 2: Aplicar a migration no ambiente de desenvolvimento**

Run: `supabase db push` (ou via MCP `apply_migration` se estiver usando o ambiente gerenciado).
Expected: migration `024_socorro_frota` aplicada sem erros; colunas `telefone_solicitante`, `precisa_guincho`, `responsavel_atendimento`, `atendimento_concluido_em` existem em `public.sinistros_frota`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/024_socorro_frota.sql
git commit -m "feat(db): adiciona colunas de socorro e tipo 'socorro' em sinistros_frota"
```

---

### Task 2: Constantes compartilhadas de Sinistros/Socorro

**Files:**
- Create: `lib/sinistro-constants.ts`

- [ ] **Step 1: Criar o arquivo de constantes**

```typescript
export const SETORES = [
  "Exposição",
  "Market",
  "E-commerce",
  "Farma",
  "Operação",
  "Outros",
] as const;

export type Setor = (typeof SETORES)[number];

export const SOCORRO_AREA_ENV_VAR: Record<Setor, string> = {
  "Exposição": "SOCORRO_AREA_EMAIL_EXPOSICAO",
  "Market": "SOCORRO_AREA_EMAIL_MARKET",
  "E-commerce": "SOCORRO_AREA_EMAIL_ECOMMERCE",
  "Farma": "SOCORRO_AREA_EMAIL_FARMA",
  "Operação": "SOCORRO_AREA_EMAIL_OPERACAO",
  "Outros": "SOCORRO_AREA_EMAIL_OUTROS",
};

export const SOCORRO_STATUSES = [
  "ABERTO",
  "EM_ATENDIMENTO",
  "GUINCHO_ACIONADO",
  "RESOLVIDO",
  "CANCELADO",
] as const;

export type SocorroStatus = (typeof SOCORRO_STATUSES)[number];

export const SOCORRO_STATUS_LABELS: Record<SocorroStatus, string> = {
  ABERTO: "Aberto",
  EM_ATENDIMENTO: "Em atendimento",
  GUINCHO_ACIONADO: "Guincho acionado",
  RESOLVIDO: "Resolvido",
  CANCELADO: "Cancelado",
};

export function isSocorroStatus(value: unknown): value is SocorroStatus {
  return typeof value === "string" && (SOCORRO_STATUSES as readonly string[]).includes(value);
}

export function resolveSocorroAreaEmails(area: string): string[] {
  const envVar = SOCORRO_AREA_ENV_VAR[area as Setor];
  if (!envVar) return [];
  const value = process.env[envVar];
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem novos erros (arquivo novo, ainda não importado em nenhum lugar).

- [ ] **Step 3: Commit**

```bash
git add lib/sinistro-constants.ts
git commit -m "feat: adiciona constantes compartilhadas de areas e status de socorro"
```

---

### Task 3: Atualizar lista de Setores no formulário existente

**Files:**
- Modify: `components/sinistros/driver-sinistro-form.tsx:1-26`

- [ ] **Step 1: Substituir a constante local `SETORES` pela compartilhada**

Em `components/sinistros/driver-sinistro-form.tsx`, remover as linhas 18-26 (a definição local de `SETORES`):

```typescript
const SETORES = [
  "Expedicao E-Commerce",
  "Expedicao Lojas",
  "Expedicao Baus",
  "MarketPlace",
  "Ship From Store",
  "Manutencao",
  "Administrativo",
];
```

E adicionar o import no topo do arquivo, junto aos demais imports (após a linha `import { cn } from "@/lib/utils";`):

```typescript
import { SETORES } from "@/lib/sinistro-constants";
```

O restante do arquivo (uso de `SETORES.map(...)` no select de Setor) não muda — a constante importada tem o mesmo formato (`string[]`/`readonly string[]`).

- [ ] **Step 2: Verificar typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros. O `<select>` de Setor agora exibe "Exposição, Market, E-commerce, Farma, Operação, Outros".

- [ ] **Step 3: Commit**

```bash
git add components/sinistros/driver-sinistro-form.tsx
git commit -m "feat: usa lista compartilhada de areas no formulario de sinistro"
```

---

### Task 4: Repositório — novos campos, status de socorro e KPI

**Files:**
- Modify: `lib/repos/sinistros.ts`

- [ ] **Step 1: Atualizar `CreateSinistroInput` e `SinistroRow`**

Em `lib/repos/sinistros.ts`, no topo do arquivo, adicionar o import:

```typescript
import type { SocorroStatus } from "@/lib/sinistro-constants";
```

Atualizar `CreateSinistroInput` (linhas 9-26) — trocar `tipo_sinistro: "veiculo" | "casa";` por `tipo_sinistro: "veiculo" | "casa" | "socorro";`, tornar `frota_id` opcional e adicionar os novos campos:

```typescript
export type CreateSinistroInput = {
  ticket_number: string;
  tipo_sinistro: "veiculo" | "casa" | "socorro";
  frota_id?: number | null;
  numero_frota?: string | null;
  placa?: string | null;
  motorista_id: string;
  motorista_nome: string;
  endereco: string;
  latitude?: number | null;
  longitude?: number | null;
  setor?: string | null;
  descricao: string;
  houve_feridos: boolean;
  samu_bombeiros_presente?: boolean | null;
  terceiros: TerceiroSinistroInput[];
  media_paths: string[];
  telefone_solicitante?: string | null;
  precisa_guincho?: boolean | null;
};
```

Atualizar `SinistroRow` (linhas 28-48) — trocar `tipo_sinistro: "veiculo" | "casa";` por `tipo_sinistro: "veiculo" | "casa" | "socorro";` e adicionar:

```typescript
export type SinistroRow = {
  id: number;
  ticket_number: string;
  tipo_sinistro: "veiculo" | "casa" | "socorro";
  frota_id: number | null;
  numero_frota: string | null;
  placa: string | null;
  motorista_id: string;
  motorista_nome: string | null;
  data_incidente: string;
  endereco: string;
  setor: string | null;
  descricao: string;
  houve_feridos: boolean;
  samu_bombeiros_presente: boolean | null;
  terceiros_quantidade: number;
  terceiros: TerceiroSinistroInput[];
  media_paths: string[];
  status: string;
  criado_em: string;
  telefone_solicitante: string | null;
  precisa_guincho: boolean | null;
  responsavel_atendimento: string | null;
  atendimento_concluido_em: string | null;
};
```

- [ ] **Step 2: Atualizar `createSinistro` para gravar os novos campos e status inicial**

Substituir o corpo de `createSinistro` (linhas 50-79) por:

```typescript
export async function createSinistro(input: CreateSinistroInput): Promise<{ id: number }> {
  const { data, error } = await supabaseManutencao
    .from("sinistros_frota")
    .insert({
      ticket_number: input.ticket_number,
      tipo_sinistro: input.tipo_sinistro,
      frota_id: input.frota_id ?? null,
      numero_frota: input.numero_frota ?? null,
      placa: input.placa ?? null,
      motorista_id: input.motorista_id,
      motorista_nome: input.motorista_nome,
      data_incidente: new Date().toISOString(),
      endereco: input.endereco,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      setor: input.setor ?? null,
      descricao: input.descricao,
      houve_feridos: input.houve_feridos,
      samu_bombeiros_presente: input.houve_feridos ? input.samu_bombeiros_presente ?? null : null,
      terceiros_quantidade: input.terceiros.length,
      terceiros: input.terceiros,
      media_paths: input.media_paths,
      status: input.tipo_sinistro === "socorro" ? "ABERTO" : "PENDENTE",
      telefone_solicitante: input.telefone_solicitante ?? null,
      precisa_guincho: input.precisa_guincho ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: Number(data.id) };
}
```

- [ ] **Step 3: Incluir as novas colunas nas listagens**

Em `listDriverSinistros` (linha 84) e `listAdminSinistros` (linha 100), adicionar as novas colunas à string de `select`. Nova string de select para ambas as funções:

```typescript
"id,ticket_number,tipo_sinistro,frota_id,numero_frota,placa,motorista_id,motorista_nome,data_incidente,endereco,setor,descricao,houve_feridos,samu_bombeiros_presente,terceiros_quantidade,terceiros,media_paths,status,criado_em,telefone_solicitante,precisa_guincho,responsavel_atendimento,atendimento_concluido_em"
```

- [ ] **Step 4: Adicionar KPI de socorros abertos**

Atualizar `sinistrosDashboardKpis` (linhas 112-125) para incluir `socorros_abertos`:

```typescript
export async function sinistrosDashboardKpis(): Promise<{
  total: number;
  pendentes: number;
  com_feridos: number;
  com_fotos: number;
  socorros_abertos: number;
}> {
  const rows = await listAdminSinistros(500);
  const STATUS_SOCORRO_ABERTO = new Set(["ABERTO", "EM_ATENDIMENTO", "GUINCHO_ACIONADO"]);
  return {
    total: rows.length,
    pendentes: rows.filter((row) => row.status === "PENDENTE").length,
    com_feridos: rows.filter((row) => row.houve_feridos).length,
    com_fotos: rows.filter((row) => (row.media_paths?.length ?? 0) > 0).length,
    socorros_abertos: rows.filter(
      (row) => row.tipo_sinistro === "socorro" && STATUS_SOCORRO_ABERTO.has(row.status)
    ).length,
  };
}
```

- [ ] **Step 5: Adicionar `updateSocorroStatus`**

Adicionar ao final do arquivo:

```typescript
export async function updateSocorroStatus(
  id: number,
  novoStatus: SocorroStatus,
  adminEmail: string
): Promise<void> {
  const { data: current, error: fetchError } = await supabaseManutencao
    .from("sinistros_frota")
    .select("tipo_sinistro,responsavel_atendimento")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;
  if (current.tipo_sinistro !== "socorro") {
    throw new Error("Apenas solicitacoes de socorro possuem esse fluxo de status.");
  }

  const update: Record<string, unknown> = {
    status: novoStatus,
    atualizado_em: new Date().toISOString(),
    atendimento_concluido_em:
      novoStatus === "RESOLVIDO" || novoStatus === "CANCELADO" ? new Date().toISOString() : null,
  };

  if (novoStatus !== "ABERTO" && !current.responsavel_atendimento) {
    update.responsavel_atendimento = adminEmail;
  }

  const { error } = await supabaseManutencao.from("sinistros_frota").update(update).eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 6: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem novos erros. (A action e a página admin ainda não usam os novos campos — isso será feito nas próximas tasks.)

- [ ] **Step 7: Commit**

```bash
git add lib/repos/sinistros.ts
git commit -m "feat(db): suporta tipo socorro, novos campos e fluxo de status no repositorio de sinistros"
```

---

### Task 5: Template de e-mail de Socorro

**Files:**
- Modify: `lib/email-templates.ts`

- [ ] **Step 1: Adicionar tipo de entrada e função de renderização**

Adicionar ao final de `lib/email-templates.ts`:

```typescript
export type SocorroNotificationInput = {
  ticketNumber: string;
  descricao: string;
  endereco: string;
  latitude?: number | null;
  longitude?: number | null;
  numeroFrota?: string | null;
  placa?: string | null;
  area: string;
  telefone: string;
  precisaGuincho: boolean;
  solicitanteNome: string;
  criadoEm: Date;
};

function formatDateTimeManaus(date: Date): string {
  return date.toLocaleString("pt-BR", { timeZone: REPORT_TIME_ZONE_LOCAL, dateStyle: "short", timeStyle: "short" });
}

const REPORT_TIME_ZONE_LOCAL = "America/Manaus";

export function renderSocorroNotification(input: SocorroNotificationInput, options: ReportOptions = {}): string {
  const mapsLink =
    input.latitude != null && input.longitude != null
      ? `<a href="https://www.google.com/maps?q=${input.latitude},${input.longitude}" target="_blank" style="color:${BLUE};font-weight:700;text-decoration:none;">Ver no mapa</a>`
      : "";

  const guinchoBanner = input.precisaGuincho
    ? `<div style="margin-bottom:14px;border:1px solid #fecaca;background:#fef2f2;border-radius:10px;padding:12px 14px;color:#b91c1c;font-weight:800;font-size:14px;">
        🚨 GUINCHO NECESSÁRIO — priorize esta solicitação
      </div>`
    : "";

  const localizacaoRow = `<tr><td style="padding:8px 12px;color:${MUTED};font-size:12px;border-bottom:1px solid #e2e8f0;">Localização</td><td style="padding:8px 12px;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0;">${escapeHtml(
    input.endereco
  )}${mapsLink ? ` &middot; ${mapsLink}` : ""}</td></tr>`;

  return shell(`
    ${header(
      "Solicitação de Socorro de Frota",
      `Ticket ${input.ticketNumber} · ${formatDateTimeManaus(input.criadoEm)}`,
      options
    )}
    <tr>
      <td style="background:#ffffff;border:1px solid ${BORDER};border-top:0;border-radius:0 0 14px 14px;padding:24px;">
        ${guinchoBanner}
        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
          <tbody>
            ${row("Área", input.area)}
            ${row("Descrição", input.descricao)}
            ${localizacaoRow}
            ${row("Telefone para contato", input.telefone)}
            ${row("Número da frota", input.numeroFrota)}
            ${row("Placa", input.placa)}
            ${row("Precisa de guincho?", input.precisaGuincho ? "Sim" : "Não")}
            ${row("Solicitante", input.solicitanteNome)}
          </tbody>
        </table>
        <div style="margin-top:16px;font-size:12px;color:${MUTED};">
          Acompanhe e atualize o status desta solicitação no painel de Sinistros.
        </div>
      </td>
    </tr>`);
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem novos erros. `shell`, `header`, `row`, `escapeHtml`, `BLUE`, `BORDER`, `MUTED` e `ReportOptions` já existem no mesmo arquivo (não exportados, mas a nova função está no mesmo módulo).

- [ ] **Step 3: Commit**

```bash
git add lib/email-templates.ts
git commit -m "feat: adiciona template de e-mail para solicitacoes de socorro"
```

---

### Task 6: Envio de e-mail de notificação de Socorro

**Files:**
- Modify: `lib/repos/email-logs.ts:20`
- Modify: `lib/email.ts`

- [ ] **Step 1: Adicionar `"socorro"` ao tipo aceito por `logEmail`**

Em `lib/repos/email-logs.ts:20`, alterar:

```typescript
  tipo: "geral" | "individual" | "diario_ia" | "disponibilidade_cd" | "painel_executivo";
```

para:

```typescript
  tipo: "geral" | "individual" | "diario_ia" | "disponibilidade_cd" | "painel_executivo" | "socorro";
```

- [ ] **Step 2: Adicionar `sendSocorroNotification` em `lib/email.ts`**

Adicionar o import no topo de `lib/email.ts`, junto aos demais imports de `@/lib/email-templates`:

```typescript
import {
  renderRelatorioGeral,
  renderRelatorioIndividual,
  renderRelatorioPainelExecutivo,
  renderSocorroNotification,
  type DashboardReportInput,
  type SocorroNotificationInput,
} from "@/lib/email-templates";
import { resolveSocorroAreaEmails } from "@/lib/sinistro-constants";
```

Adicionar ao final do arquivo:

```typescript
const MONITORAMENTO_FROTAS_EMAIL = "monitoramentofrotas@bemol.com.br";

function parseEmailList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function sendSocorroNotification(args: {
  input: SocorroNotificationInput;
}): Promise<SendResult> {
  const { input } = args;

  const destinatarios = Array.from(
    new Set([
      ...parseEmailList(process.env.FROTAS_MANUTENCAO_EMAILS),
      MONITORAMENTO_FROTAS_EMAIL,
      ...resolveSocorroAreaEmails(input.area),
    ])
  );

  if (destinatarios.length === 0) {
    return { ok: false, error: "Nenhum destinatario configurado para notificacao de socorro." };
  }

  const prioridade = input.precisaGuincho ? "[URGENTE] " : "";
  const guinchoLabel = input.precisaGuincho ? "sim" : "nao";
  const assunto = `${prioridade}[SOCORRO FROTA] Nova solicitacao - Area: ${input.area} - Guincho: ${guinchoLabel}`;
  const html = renderSocorroNotification(input);
  const destinatariosLog = destinatarios.join(",");

  try {
    await mailClient().send({
      from: FROM,
      to: destinatarios,
      subject: assunto,
      html,
    });
    await safeLogEmail({
      tipo: "socorro",
      destinatarios: destinatariosLog,
      assunto,
      enviadoPor: input.solicitanteNome,
      status: "enviado",
    });
    return { ok: true };
  } catch (e) {
    const msg = sendGridErrorMessage(e);
    console.error("Erro no envio da notificacao de socorro", msg);
    await safeLogEmail({
      tipo: "socorro",
      destinatarios: destinatariosLog,
      assunto,
      enviadoPor: input.solicitanteNome,
      status: "erro",
      erroMsg: msg,
    });
    return { ok: false, error: publicEmailErrorMessage(msg) };
  }
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

- [ ] **Step 4: Commit**

```bash
git add lib/repos/email-logs.ts lib/email.ts
git commit -m "feat: envia notificacao por e-mail ao abrir solicitacao de socorro"
```

---

### Task 7: Formulário do motorista — `SocorroForm`

**Files:**
- Create: `components/sinistros/socorro-form.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Camera, ChevronRight, Loader2, MapPin, Send } from "lucide-react";
import { enviarSinistroMotoristaAction } from "@/app/(app)/motorista/sinistro/_actions";
import { SINISTRO_MOTORISTA_INITIAL_STATE } from "@/app/(app)/motorista/sinistro/types";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SETORES } from "@/lib/sinistro-constants";
import { cn } from "@/lib/utils";

export function SocorroForm() {
  const router = useRouter();
  const [actionState, formAction] = useActionState(
    enviarSinistroMotoristaAction,
    SINISTRO_MOTORISTA_INITIAL_STATE
  );
  const [precisaGuincho, setPrecisaGuincho] = useState("");
  const [mediaCount, setMediaCount] = useState(0);
  const [locationLoading, setLocationLoading] = useState(false);
  const [endereco, setEndereco] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (actionState.ok) router.push(actionState.redirectTo);
  }, [actionState, router]);

  function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    setMediaCount(event.target.files?.length ?? 0);
  }

  async function getLocation() {
    setFormError(null);
    if (!navigator.geolocation) {
      setFormError("GPS indisponivel neste dispositivo.");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setLatitude(String(lat));
        setLongitude(String(lon));

        try {
          const response = await fetch(
            `/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&accuracy=${encodeURIComponent(position.coords.accuracy)}`
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error ?? "Nao foi possivel buscar o endereco.");
          setEndereco(data?.address || `Lat: ${lat.toFixed(6)}, Lng: ${lon.toFixed(6)}`);
        } catch {
          setEndereco(`Lat: ${lat.toFixed(6)}, Lng: ${lon.toFixed(6)}`);
        } finally {
          setLocationLoading(false);
        }
      },
      () => {
        setLocationLoading(false);
        setFormError("Nao foi possivel obter sua localizacao.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  function handlePreSubmit(event: { preventDefault(): void }) {
    if (!precisaGuincho) {
      event.preventDefault();
      setFormError("Informe se precisa de guincho.");
      return;
    }
    setFormError(null);
  }

  return (
    <form action={formAction} onSubmit={handlePreSubmit} className="mx-auto max-w-3xl space-y-5">
      <input type="hidden" name="tipo_sinistro" value="socorro" />
      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />
      <input type="hidden" name="terceiros_quantidade" value="0" />

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-700">Help Motora</p>
        <h1 className="text-2xl font-bold tracking-tight">Solicitar socorro</h1>
        <p className="text-sm text-muted-foreground">
          Preencha os dados para acionar manutencao e monitoramento.
        </p>
      </div>

      {(!actionState.ok && actionState.error) || formError ? (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {formError ?? (!actionState.ok ? actionState.error : null)}
        </div>
      ) : null}

      <section className="space-y-4 rounded-md border bg-white p-4 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="descricao">O que aconteceu? *</Label>
          <textarea
            id="descricao"
            name="descricao"
            rows={4}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Descreva o problema"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endereco">Endereco *</Label>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              id="endereco"
              name="endereco"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              required
              placeholder="Digite o endereco"
            />
            <Button type="button" variant="outline" onClick={getLocation} disabled={locationLoading}>
              {locationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              Usar minha localizacao
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="numero_frota">Numero da frota</Label>
            <Input id="numero_frota" name="numero_frota" placeholder="Ex: 4021" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="placa">Placa</Label>
            <Input id="placa" name="placa" placeholder="Ex: ABC1D23" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="setor">Setor *</Label>
            <select
              id="setor"
              name="setor"
              required
              defaultValue=""
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione um setor</option>
              {SETORES.map((setor) => (
                <option key={setor} value={setor}>
                  {setor}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone_solicitante">Telefone do motorista *</Label>
            <Input
              id="telefone_solicitante"
              name="telefone_solicitante"
              required
              inputMode="numeric"
              placeholder="Somente numeros"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Precisa de guincho? *</Label>
          <div className="grid grid-cols-2 gap-2">
            <Choice name="precisa_guincho" value="sim" checked={precisaGuincho === "sim"} onChange={setPrecisaGuincho}>
              Sim
            </Choice>
            <Choice name="precisa_guincho" value="nao" checked={precisaGuincho === "nao"} onChange={setPrecisaGuincho}>
              Nao
            </Choice>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-md border bg-white p-4 shadow-sm">
        <Label htmlFor="media">Imagens (opcional)</Label>
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-slate-50 p-4 text-center text-sm text-muted-foreground hover:bg-slate-100">
          <Camera className="mb-2 h-6 w-6 text-blue-700" aria-hidden="true" />
          Adicionar imagens
          <input
            id="media"
            name="media"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            className="sr-only"
            onChange={handleMediaChange}
          />
        </label>
        {mediaCount > 0 ? <p className="text-xs font-medium text-blue-700">{mediaCount} arquivo(s) selecionado(s)</p> : null}
      </section>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function Choice({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked?: boolean;
  onChange?: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex h-10 cursor-pointer items-center justify-center rounded-md border bg-white px-3 text-sm font-medium transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-800"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange?.(value)}
        className="sr-only"
        required
      />
      {children}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} size="lg">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {pending ? "Enviando..." : "Enviar solicitacao"}
      {!pending ? <ChevronRight className="h-4 w-4" /> : null}
    </Button>
  );
}
```

- [ ] **Step 2: Verificar typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem novos erros. (A action ainda não trata `tipo_sinistro = "socorro"` — será feito na Task 8, então o envio do form ainda falhará nessa task; isso é esperado e corrigido na próxima.)

- [ ] **Step 3: Commit**

```bash
git add components/sinistros/socorro-form.tsx
git commit -m "feat: adiciona formulario de solicitacao de socorro do motorista"
```

---

### Task 8: Server action — suportar tipo "socorro"

**Files:**
- Modify: `app/(app)/motorista/sinistro/_actions.ts`

- [ ] **Step 1: Atualizar schema de tipo e imports**

Em `app/(app)/motorista/sinistro/_actions.ts:14`, alterar:

```typescript
const TipoSinistroSchema = z.enum(["veiculo", "casa"]);
```

para:

```typescript
const TipoSinistroSchema = z.enum(["veiculo", "casa", "socorro"]);
```

Adicionar import no topo do arquivo (junto aos demais imports):

```typescript
import { sendSocorroNotification } from "@/lib/email";
```

- [ ] **Step 2: Tratar o fluxo "socorro" em `enviarSinistroMotoristaAction`**

Em `app/(app)/motorista/sinistro/_actions.ts`, dentro do `try` (linhas 50-106), a lógica atual sempre exige `frota_id`, `houve_feridos` e `terceiros`. Reestruturar para ramificar por tipo. Substituir o bloco do `try` por:

```typescript
  try {
    const tipoSinistro = TipoSinistroSchema.parse(formData.get("tipo_sinistro"));
    const descricao = requiredText(formData, "descricao", "Descreva o que aconteceu.");
    const endereco = requiredText(formData, "endereco", "Informe o endereco.");
    const setor = optionalText(formData, "setor");
    const terceirosQuantidade = z.coerce.number().int().min(0).max(10).parse(formData.get("terceiros_quantidade") ?? "0");

    const ticketNumber = generateTicketNumber();
    const mediaFiles = formData
      .getAll("media")
      .map(fileFromForm)
      .filter((file): file is File => Boolean(file));

    if (tipoSinistro === "socorro") {
      const telefoneSolicitante = requiredText(formData, "telefone_solicitante", "Informe o telefone para contato.").replace(/\D/g, "");
      const precisaGuincho = BoolStringSchema.parse(formData.get("precisa_guincho")) === "sim";
      const setorObrigatorio = requiredText(formData, "setor", "Selecione um setor.");
      const numeroFrota = optionalText(formData, "numero_frota");
      const placa = optionalText(formData, "placa");

      const uploadedPathsSocorro: string[] = [];
      for (const file of mediaFiles.slice(0, 8)) {
        const path = await uploadSinistroImage(file, { ticketNumber });
        uploadedPathsSocorro.push(path);
      }

      try {
        await createSinistro({
          ticket_number: ticketNumber,
          tipo_sinistro: "socorro",
          numero_frota: numeroFrota,
          placa,
          motorista_id: user.email,
          motorista_nome: user.name,
          endereco,
          latitude: optionalNumber(formData, "latitude"),
          longitude: optionalNumber(formData, "longitude"),
          setor: setorObrigatorio,
          descricao,
          houve_feridos: false,
          terceiros: [],
          media_paths: uploadedPathsSocorro,
          telefone_solicitante: telefoneSolicitante,
          precisa_guincho: precisaGuincho,
        });
      } catch (createError) {
        await removeSinistroImages(uploadedPathsSocorro).catch((cleanupError) => {
          console.warn("[sinistros] falha ao limpar imagens apos erro", cleanupError);
        });
        throw createError;
      }

      await sendSocorroNotification({
        input: {
          ticketNumber,
          descricao,
          endereco,
          latitude: optionalNumber(formData, "latitude"),
          longitude: optionalNumber(formData, "longitude"),
          numeroFrota,
          placa,
          area: setorObrigatorio,
          telefone: telefoneSolicitante,
          precisaGuincho,
          solicitanteNome: user.name,
          criadoEm: new Date(),
        },
      }).catch((notifyError) => {
        console.warn("[sinistros] falha ao enviar notificacao de socorro", notifyError);
      });

      revalidatePath("/motorista");
      revalidatePath("/motorista/sinistros");
      return { ok: true, redirectTo: `/motorista/sinistros?ticket=${encodeURIComponent(ticketNumber)}` };
    }

    const frotaId = z.coerce.number().int().positive("Selecione uma frota.").parse(formData.get("frota_id"));
    const houveFeridos = BoolStringSchema.parse(formData.get("houve_feridos")) === "sim";
    const samuBombeirosPresente = houveFeridos
      ? BoolStringSchema.parse(formData.get("samu_bombeiros_presente")) === "sim"
      : null;

    const terceiros = Array.from({ length: terceirosQuantidade }, (_, index) => {
      const prefix = `terceiro_${index}`;
      return {
        nome: requiredText(formData, `${prefix}_nome`, "Preencha o nome de todos os terceiros."),
        telefone: requiredText(formData, `${prefix}_telefone`, "Preencha o telefone de todos os terceiros.").replace(/\D/g, ""),
        cpf: requiredText(formData, `${prefix}_cpf`, "Preencha o CPF de todos os terceiros.").replace(/\D/g, ""),
      };
    });

    const frota = await getFrota(frotaId);
    if (!frota || !frota.ativo || frota.vendido) throw new Error("Frota indisponivel para reporte de sinistro.");

    for (const file of mediaFiles.slice(0, 8)) {
      const path = await uploadSinistroImage(file, { ticketNumber });
      uploadedPaths.push(path);
    }

    await createSinistro({
      ticket_number: ticketNumber,
      tipo_sinistro: tipoSinistro,
      frota_id: frotaId,
      numero_frota: frota.frota_geral ?? null,
      placa: frota.placa ?? null,
      motorista_id: user.email,
      motorista_nome: user.name,
      endereco,
      latitude: optionalNumber(formData, "latitude"),
      longitude: optionalNumber(formData, "longitude"),
      setor,
      descricao,
      houve_feridos: houveFeridos,
      samu_bombeiros_presente: samuBombeirosPresente,
      terceiros,
      media_paths: uploadedPaths,
    });

    revalidatePath("/motorista");
    revalidatePath("/motorista/sinistros");
    return { ok: true, redirectTo: `/motorista/sinistros?ticket=${encodeURIComponent(ticketNumber)}` };
  } catch (error) {
    await removeSinistroImages(uploadedPaths).catch((cleanupError) => {
      console.warn("[sinistros] falha ao limpar imagens apos erro", cleanupError);
    });
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Dados invalidos no sinistro." };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Nao foi possivel enviar o sinistro." };
  }
```

Nota: `uploadedPaths` (declarado em `const uploadedPaths: string[] = []` no topo da função, linha 48) continua sendo usado pelo branch `veiculo`/`casa` e pelo cleanup do `catch`. O branch `socorro` usa sua própria variável `uploadedPathsSocorro` e faz seu próprio cleanup antes de relançar o erro, então o `catch` externo (que limpa `uploadedPaths`, vazio nesse caso) não duplica a limpeza.

`TipoSinistroSchema` agora é `z.enum(["veiculo", "casa", "socorro"])` mas `createSinistro` espera `tipo_sinistro: "veiculo" | "casa" | "socorro"` (Task 4) — compatível.

- [ ] **Step 3: Verificar typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem novos erros.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/motorista/sinistro/_actions.ts
git commit -m "feat: trata envio de solicitacoes de socorro na action de sinistro"
```

---

### Task 9: Tela de seleção — novo card "Socorro / Help Motora"

**Files:**
- Modify: `app/(app)/motorista/sinistro/page.tsx`

- [ ] **Step 1: Adicionar o terceiro card**

Em `app/(app)/motorista/sinistro/page.tsx:1-2`, adicionar `LifeBuoy` ao import de ícones:

```typescript
import { Car, ChevronRight, Home, LifeBuoy } from "lucide-react";
```

Após o card "Acidente com Casas" (linhas 27-33), adicionar:

```tsx
        <SinistroTypeCard
          href="/motorista/sinistro/socorro"
          icon={LifeBuoy}
          title="Socorro / Help Motora"
          description="Solicitar ajuda para pane, acidente ou guincho"
          tone="red"
        />
```

Atualizar a assinatura de `SinistroTypeCard` (linhas 39-51) para aceitar o novo tom `"red"`:

```typescript
function SinistroTypeCard({
  href,
  icon: Icon,
  title,
  description,
  tone,
}: {
  href: string;
  icon: typeof Car;
  title: string;
  description: string;
  tone: "blue" | "sky" | "red";
}) {
```

E no `className` do `<span>` do ícone (linha 56-59), adicionar a cor para `"red"`:

```tsx
        <span
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full text-white",
            tone === "blue" ? "bg-blue-600" : tone === "sky" ? "bg-sky-500" : "bg-red-600"
          )}
        >
```

- [ ] **Step 2: Verificar typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/motorista/sinistro/page.tsx
git commit -m "feat: adiciona card de Socorro / Help Motora na selecao de sinistro"
```

---

### Task 10: Rota dinâmica — renderizar `SocorroForm`

**Files:**
- Modify: `app/(app)/motorista/sinistro/[tipo]/page.tsx`

- [ ] **Step 1: Aceitar "socorro" e renderizar o componente correto**

Substituir o conteúdo de `app/(app)/motorista/sinistro/[tipo]/page.tsx` por:

```tsx
import { notFound } from "next/navigation";
import { DriverSinistroForm, type SinistroTipo } from "@/components/sinistros/driver-sinistro-form";
import { SocorroForm } from "@/components/sinistros/socorro-form";
import { listFrotas } from "@/lib/repos/frotas";
import { requireAppUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const TIPOS_VALIDOS = new Set(["veiculo", "casa", "socorro"]);

export default async function ReportarSinistroTipoPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  await requireAppUser();
  const { tipo } = await params;
  if (!TIPOS_VALIDOS.has(tipo)) notFound();

  if (tipo === "socorro") {
    return <SocorroForm />;
  }

  const { rows } = await listFrotas({ pageSize: 200 });
  return <DriverSinistroForm frotas={rows} tipo={tipo as SinistroTipo} />;
}
```

- [ ] **Step 2: Verificar typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/motorista/sinistro/\[tipo\]/page.tsx
git commit -m "feat: roteia tipo socorro para o novo formulario"
```

---

### Task 11: Server action admin — atualizar status de Socorro

**Files:**
- Create: `app/(app)/sinistros/_actions.ts`

- [ ] **Step 1: Criar a action**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateSocorroStatus } from "@/lib/repos/sinistros";
import { isSocorroStatus } from "@/lib/sinistro-constants";
import { requireAdminUser } from "@/lib/rbac";

const UpdateStatusSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.string().refine(isSocorroStatus, "Status invalido."),
});

export async function atualizarStatusSocorroAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser();
  const { id, status } = UpdateStatusSchema.parse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  await updateSocorroStatus(id, status, user.email);
  revalidatePath("/sinistros");
}
```

- [ ] **Step 2: Verificar a assinatura de `requireAdminUser`**

Run: `npx tsc --noEmit`
Expected: sem erros. Se `requireAdminUser()` não retornar um objeto com `email`, ajustar `user.email` conforme o retorno real (verificar `lib/rbac.ts`, que define `AppUser = { email, name, perfil }` e `requireAdminUser` reaproveita esse tipo).

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/sinistros/_actions.ts
git commit -m "feat: adiciona action de atualizacao de status de socorro"
```

---

### Task 12: Painel admin — KPI, filtro, campos extras e atualização de status

**Files:**
- Modify: `app/(app)/sinistros/page.tsx`

- [ ] **Step 1: Adicionar imports e KPI de socorros abertos**

No topo de `app/(app)/sinistros/page.tsx`, adicionar:

```typescript
import { atualizarStatusSocorroAction } from "./_actions";
import { SOCORRO_STATUS_LABELS, SOCORRO_STATUSES } from "@/lib/sinistro-constants";
import { LifeBuoy } from "lucide-react";
```

(`LifeBuoy` substitui/complementa os ícones já importados de `lucide-react` — adicionar ao import existente na linha 2.)

No grid de KPIs (linhas 41-46), adicionar um quinto card e ajustar o grid para `xl:grid-cols-5`:

```tsx
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Kpi title="Total" value={kpis.total} icon={<ShieldAlert className="h-4 w-4" />} />
        <Kpi title="Pendentes" value={kpis.pendentes} icon={<AlertTriangle className="h-4 w-4" />} />
        <Kpi title="Com feridos" value={kpis.com_feridos} icon={<UserRound className="h-4 w-4" />} />
        <Kpi title="Com fotos" value={kpis.com_fotos} icon={<Camera className="h-4 w-4" />} />
        <Kpi title="Socorros abertos" value={kpis.socorros_abertos} icon={<LifeBuoy className="h-4 w-4" />} />
      </div>
```

- [ ] **Step 2: Adicionar filtro por tipo via query param**

Atualizar a assinatura de `SinistrosAdminPage` para receber `searchParams` e filtrar a lista antes de mapear para `SinistroAdminRow`:

```tsx
export default async function SinistrosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  await requireAdminUser();
  const { tipo: tipoFiltro } = await searchParams;
  const [kpis, allRows] = await Promise.all([sinistrosDashboardKpis(), listAdminSinistros(200)]);
  const rows = tipoFiltro && tipoFiltro !== "todos" ? allRows.filter((row) => row.tipo_sinistro === tipoFiltro) : allRows;
  const sinistros: SinistroAdminRow[] = await Promise.all(
    rows.map(async (row) => ({
```

(O restante do `Promise.all` de `signed_media_urls` permanece igual.)

Adicionar a barra de filtros logo após o título (após `</div>` da linha 39):

```tsx
      <div className="flex flex-wrap gap-2">
        <FiltroTipoLink tipo="todos" label="Todos" ativo={!tipoFiltro || tipoFiltro === "todos"} />
        <FiltroTipoLink tipo="veiculo" label="Veiculo" ativo={tipoFiltro === "veiculo"} />
        <FiltroTipoLink tipo="casa" label="Casa" ativo={tipoFiltro === "casa"} />
        <FiltroTipoLink tipo="socorro" label="Socorro" ativo={tipoFiltro === "socorro"} />
      </div>
```

E adicionar o componente `FiltroTipoLink` junto aos demais componentes auxiliares (próximo de `Kpi`):

```tsx
function FiltroTipoLink({ tipo, label, ativo }: { tipo: string; label: string; ativo: boolean }) {
  return (
    <Link
      href={tipo === "todos" ? "/sinistros" : `/sinistros?tipo=${tipo}`}
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        ativo ? "border-blue-500 bg-blue-50 text-blue-800" : "border-transparent bg-white text-muted-foreground hover:bg-slate-50"
      )}
    >
      {label}
    </Link>
  );
}
```

Adicionar o import de `cn` no topo do arquivo:

```typescript
import { cn } from "@/lib/utils";
```

- [ ] **Step 3: Exibir badge de tipo "SOCORRO" e badge de status colorido**

No `SinistroCard` (linha 68), atualizar o badge de tipo:

```tsx
            <Badge variant="outline">
              {sinistro.tipo_sinistro === "casa" ? "CASA" : sinistro.tipo_sinistro === "socorro" ? "SOCORRO" : "VEÍCULO"}
            </Badge>
```

Substituir o badge de status (linha 69) por uma chamada a um novo componente `StatusBadge`:

```tsx
            <StatusBadge sinistro={sinistro} />
```

Adicionar o componente `StatusBadge` junto aos demais componentes auxiliares:

```tsx
function StatusBadge({ sinistro }: { sinistro: SinistroAdminRow }) {
  if (sinistro.tipo_sinistro !== "socorro") {
    return <Badge variant="outline">{sinistro.status}</Badge>;
  }

  const tone: Record<string, string> = {
    ABERTO: "border-slate-200 bg-slate-50 text-slate-700",
    EM_ATENDIMENTO: "border-blue-200 bg-blue-50 text-blue-800",
    GUINCHO_ACIONADO: "border-orange-200 bg-orange-50 text-orange-800",
    RESOLVIDO: "border-green-200 bg-green-50 text-green-800",
    CANCELADO: "border-red-200 bg-red-50 text-red-800",
  };
  const label = SOCORRO_STATUS_LABELS[sinistro.status as keyof typeof SOCORRO_STATUS_LABELS] ?? sinistro.status;
  const className = tone[sinistro.status] ?? "border-slate-200 bg-slate-50 text-slate-700";

  return <Badge variant="outline" className={className}>{label}</Badge>;
}
```

- [ ] **Step 4: Exibir campos extras de Socorro e formulário de atualização de status**

Dentro de `SinistroCard`, após o bloco `<Terceiros .../>` (linha 98), adicionar:

```tsx
          {sinistro.tipo_sinistro === "socorro" ? <SocorroExtras sinistro={sinistro} /> : null}
```

Adicionar o componente `SocorroExtras` junto aos demais componentes auxiliares:

```tsx
function SocorroExtras({ sinistro }: { sinistro: SinistroAdminRow }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Info label="Telefone do solicitante" value={sinistro.telefone_solicitante ?? "-"} />
        <Info label="Precisa de guincho?" value={sinistro.precisa_guincho ? "Sim" : "Nao"} />
        <Info label="Responsavel pelo atendimento" value={sinistro.responsavel_atendimento ?? "Nao atribuido"} />
      </div>
      <form action={atualizarStatusSocorroAction} className="flex flex-wrap items-end gap-2 rounded-md border bg-slate-50 p-3">
        <input type="hidden" name="id" value={sinistro.id} />
        <div className="space-y-1">
          <label htmlFor={`status-${sinistro.id}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Atualizar status
          </label>
          <select
            id={`status-${sinistro.id}`}
            name="status"
            defaultValue={sinistro.status}
            className="flex h-9 rounded-md border border-input bg-white px-3 text-sm"
          >
            {SOCORRO_STATUSES.map((status) => (
              <option key={status} value={status}>
                {SOCORRO_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline">
          Atualizar
        </Button>
      </form>
    </div>
  );
}
```

`Button` já está importado em `app/(app)/sinistros/page.tsx`? Verificar — se não estiver, adicionar:

```typescript
import { Button } from "@/components/ui/button";
```

- [ ] **Step 5: Verificar typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem novos erros.

- [ ] **Step 6: Verificação manual**

Run: `npm run dev`
- Acessar `/motorista/sinistro` logado como motorista → confirmar que aparece o card "Socorro / Help Motora" e que ele leva ao novo formulário.
- Preencher e enviar o formulário de socorro → confirmar redirecionamento para `/motorista/sinistros?ticket=...` e que um e-mail (ou log de erro de e-mail, se SendGrid não configurado localmente) é registrado em `email_logs` com `tipo = "socorro"`.
- Acessar `/sinistros` logado como admin → confirmar:
  - card "Socorros abertos" no KPI
  - filtro "Socorro" mostra apenas o tipo socorro
  - card do ticket criado mostra telefone, guincho, área/setor e o seletor de status
  - alterar o status e confirmar que a página recarrega com o novo status e "Responsavel pelo atendimento" preenchido

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/sinistros/page.tsx
git commit -m "feat: exibe e permite atualizar status de solicitacoes de socorro no painel admin"
```

---

## Spec coverage check

- Formulário com descrição, localização (GPS), telefone, área, guincho, número de frota/placa: Tasks 7-8 ✅
- E-mail para manutenção + monitoramentofrotas@bemol.com.br + roteamento por área: Task 6 ✅
- Assunto com prioridade de guincho: Task 6 ✅
- WhatsApp Daniel/Luciana: fora de escopo (registrado no spec) ✅
- Armazenamento para histórico/consulta: reaproveita `sinistros_frota` + listagens existentes (Tasks 4, 12) ✅
- Status (Aberto, Em atendimento, Guincho acionado, Resolvido, Cancelado) + responsável + datas: Tasks 4, 11, 12 ✅
- Botão visível no fluxo do motorista, mobile-first: Task 9 (mesmo padrão visual dos outros cards) ✅
- Painel para acompanhar solicitações: reaproveita `/sinistros` com filtro por tipo (Task 12) ✅
