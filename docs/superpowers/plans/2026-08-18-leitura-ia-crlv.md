# Leitura automática de CRLV por IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ler a data de vencimento do CRLV direto do PDF (via IA de visão), em vez de confiar só na digitação manual, tanto em novos uploads quanto num backfill dos ~176 documentos já cadastrados.

**Architecture:** Renderiza a 1ª página do PDF em PNG em memória (`pdfjs-dist` + `@napi-rs/canvas`), manda pro mesmo pipeline de visão Azure OpenAI/OpenAI já usado pelo hodômetro (`lib/ai/odometer.ts`), valida a resposta com Zod, e usa a data lida (se confiança alta) pra preencher `documents.crlv_vencimento` automaticamente. Baixa confiança/falha → mantém o valor manual e marca `crlv_revisar_manualmente = true` pra alguém conferir na Central de Documentos.

**Tech Stack:** TypeScript, Next.js Server Actions, Supabase (Postgres + Storage), `openai` SDK (client Azure OpenAI já configurado), `pdfjs-dist`, `@napi-rs/canvas`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-leitura-ia-crlv-design.md`

## Global Constraints

- O PDF salvo em `documents.crlv_url` (Supabase Storage, bucket `documents`) nunca é alterado — a conversão pra imagem é só em memória, por chamada.
- Confiança >= 0.7 e leitura segura → usa a data lida pela IA (prevalece sobre o campo digitado). Caso contrário → mantém o valor manual existente (se houver) e marca `crlv_revisar_manualmente = true`.
- Falha na chamada de IA (timeout, API fora, PDF ilegível) nunca bloqueia o upload nem lança exceção pro chamador — sempre cai no caminho "manual" acima.
- Sem cache de leitura (diferente do hodômetro) — cada CRLV é lido uma vez.
- Backfill roda uma vez, manualmente, via `npx tsx scripts/backfill-crlv-ocr.ts` — sem agendamento.

---

### Task 1: Extrair client de visão compartilhado

**Files:**
- Create: `lib/ai/vision-client.ts`
- Modify: `lib/ai/odometer.ts:79-147` (remove client init e `getVisionModel` locais, importa do novo módulo)
- Test: nenhum teste novo — a rede de segurança é `lib/ai/odometer.test.ts` já existente continuando verde

**Interfaces:**
- Produces: `getVisionClient(): OpenAI | null`, `getVisionModel(): string` — exportados de `lib/ai/vision-client.ts`, usados por `odometer.ts` e (na Task 3) por `crlv-ocr.ts`.

- [ ] **Step 1: Criar `lib/ai/vision-client.ts` com o código movido de `odometer.ts`**

```typescript
import OpenAI, { AzureOpenAI } from "openai";

// Cliente compartilhado de visão (Azure OpenAI ou OpenAI direto), usado tanto
// pela leitura de hodômetro quanto pela leitura de CRLV. Inicializado eager no
// module-level pra eliminar latência de cold-start.
const client: OpenAI | null = (() => {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const azureKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const azureDeployment =
    process.env.AZURE_OPENAI_VISION_DEPLOYMENT?.trim() ?? process.env.AZURE_OPENAI_DEPLOYMENT?.trim();

  if (azureEndpoint && azureKey && azureDeployment) {
    // AzureOpenAI monta a URL correta /openai/deployments/{deployment}/chat/completions
    return new AzureOpenAI({
      apiKey: azureKey,
      endpoint: azureEndpoint.replace(/\/$/, ""),
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2025-01-01-preview",
      deployment: azureDeployment,
      timeout: 60_000,
      maxRetries: 1,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });
})();

export function getVisionClient(): OpenAI | null {
  return client;
}

export function getVisionModel(): string {
  return (
    process.env.AZURE_OPENAI_VISION_DEPLOYMENT ??
    process.env.OPENAI_VISION_MODEL ??
    "gpt-4o"
  );
}
```

- [ ] **Step 2: Atualizar `lib/ai/odometer.ts` pra importar do novo módulo**

Remover de `odometer.ts` (linhas 79-107 e 141-147 no arquivo atual: o bloco `const client: OpenAI | null = (() => {...})()`, a função `getOpenAIClient`, e a função `getVisionModel`), e no topo do arquivo adicionar:

```typescript
import { getVisionClient, getVisionModel } from "@/lib/ai/vision-client";
```

Substituir as duas chamadas a `getOpenAIClient()` restantes no arquivo (dentro de `analyzeOdometerImage`) por `getVisionClient()`. As chamadas a `getVisionModel()` já existentes continuam funcionando sem mudança (mesmo nome, agora importado).

- [ ] **Step 3: Rodar os testes existentes pra garantir que nada quebrou**

Run: `npx vitest run lib/ai/odometer.test.ts`
Expected: PASS (mesmos 2 testes de antes, comportamento do hodômetro inalterado)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add lib/ai/vision-client.ts lib/ai/odometer.ts
git commit -m "refactor: extrai client de visão compartilhado de lib/ai/odometer.ts"
```

---

### Task 2: Renderização de PDF em imagem

**Files:**
- Create: `lib/ai/pdf-render.ts`
- Create: `lib/ai/pdf-render.test.ts`
- Modify: `package.json` (novas dependências)

**Interfaces:**
- Produces: `renderFirstPageToPng(pdfBuffer: Buffer): Promise<Buffer>` — usado pela Task 3.

- [ ] **Step 1: Instalar as dependências novas**

```bash
npm install pdfjs-dist @napi-rs/canvas
```

- [ ] **Step 2: Escrever o teste (usa `pdf-lib`, já uma dependência do projeto, pra gerar um PDF mínimo em memória — sem precisar de arquivo fixture binário no repo)**

```typescript
// lib/ai/pdf-render.test.ts
import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { renderFirstPageToPng } from "./pdf-render";

async function buildTestPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([400, 300]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("CRLV DE TESTE - Valido ate 15/05/2026", { x: 20, y: 150, size: 14, font });
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

describe("renderFirstPageToPng", () => {
  it("renderiza a primeira página de um PDF válido como PNG não vazio", async () => {
    const pdfBuffer = await buildTestPdf();
    const png = await renderFirstPageToPng(pdfBuffer);
    expect(png).toBeInstanceOf(Buffer);
    expect(png.length).toBeGreaterThan(0);
    // Assinatura PNG: 89 50 4E 47 0D 0A 1A 0A
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("propaga erro para PDF corrompido/inválido", async () => {
    const garbage = Buffer.from("isso não é um PDF");
    await expect(renderFirstPageToPng(garbage)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Rodar o teste pra confirmar que falha (módulo ainda não existe)**

Run: `npx vitest run lib/ai/pdf-render.test.ts`
Expected: FAIL com "Cannot find module './pdf-render'"

- [ ] **Step 4: Implementar `lib/ai/pdf-render.ts`**

```typescript
import { createCanvas } from "@napi-rs/canvas";
// Build "legacy" roda sem worker em Node — evita configurar GlobalWorkerOptions.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Renderiza a primeira página de um PDF como PNG, em memória. Usado pra dar à IA
// de visão uma imagem que ela consegue ler (o modelo de chat.completions não
// aceita PDF direto) — o PDF original nunca é alterado, isso é só um passo
// temporário antes da chamada à IA.
export async function renderFirstPageToPng(pdfBuffer: Buffer): Promise<Buffer> {
  const loadingTask = getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(1);
    // Escala 2x: texto pequeno do CRLV (datas, campos) fica legível pro modelo.
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    return canvas.toBuffer("image/png");
  } finally {
    await pdf.destroy();
  }
}
```

- [ ] **Step 5: Rodar o teste de novo**

Run: `npx vitest run lib/ai/pdf-render.test.ts`
Expected: PASS. Se a API do `pdfjs-dist`/`@napi-rs/canvas` divergir do esperado (erro de tipo ou de runtime), ajuste a implementação até os dois testes passarem — a assinatura PNG e o teste de PDF corrompido são o critério de aceite, não a forma exata do código acima.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: sem erros. Se `pdfjs-dist` não tiver tipos pro caminho `legacy/build/pdf.mjs`, adicione `// @ts-expect-error pdfjs-dist não publica types pro build legacy` acima do import.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/ai/pdf-render.ts lib/ai/pdf-render.test.ts
git commit -m "feat: adiciona renderização de PDF em imagem para leitura por IA"
```

---

### Task 3: Leitura do CRLV por IA

**Files:**
- Create: `lib/ai/crlv-ocr.ts`
- Create: `lib/ai/crlv-ocr.test.ts`

**Interfaces:**
- Consumes: `renderFirstPageToPng(pdfBuffer: Buffer): Promise<Buffer>` (Task 2), `getVisionClient(): OpenAI | null`, `getVisionModel(): string` (Task 1).
- Produces: `type CrlvReading = { data_vencimento: string | null; confianca: number; leitura_segura: boolean; motivo: string | null }`, `readCrlvVencimento(pdfBuffer: Buffer): Promise<CrlvReading>` — usado pela Task 6 (action de upload) e Task 8 (script de backfill).

- [ ] **Step 1: Escrever os testes da parte pura (schema + threshold) — sem chamar a API de verdade, mesmo padrão de `lib/ai/odometer.test.ts`**

```typescript
// lib/ai/crlv-ocr.test.ts
import { describe, expect, it } from "vitest";
import { CrlvReadingSchema, applyConfidenceThreshold } from "./crlv-ocr";

describe("CrlvReadingSchema", () => {
  it("aceita uma resposta válida da IA", () => {
    const result = CrlvReadingSchema.safeParse({
      data_vencimento: "2026-05-15",
      confianca: 0.95,
      leitura_segura: true,
      motivo: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita data em formato errado", () => {
    const result = CrlvReadingSchema.safeParse({
      data_vencimento: "15/05/2026",
      confianca: 0.95,
      leitura_segura: true,
      motivo: null,
    });
    expect(result.success).toBe(false);
  });

  it("aceita data_vencimento nula quando a IA não encontrou o campo", () => {
    const result = CrlvReadingSchema.safeParse({
      data_vencimento: null,
      confianca: 0.2,
      leitura_segura: false,
      motivo: "Documento ilegível",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita confiança fora do intervalo 0-1", () => {
    const result = CrlvReadingSchema.safeParse({
      data_vencimento: "2026-05-15",
      confianca: 1.5,
      leitura_segura: true,
      motivo: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("applyConfidenceThreshold", () => {
  it("mantém leitura_segura quando confiança >= 0.7 e há data", () => {
    const reading = { data_vencimento: "2026-05-15", confianca: 0.9, leitura_segura: true, motivo: null };
    expect(applyConfidenceThreshold(reading).leitura_segura).toBe(true);
  });

  it("derruba leitura_segura quando confiança < 0.7, mesmo que a IA tenha marcado true", () => {
    const reading = { data_vencimento: "2026-05-15", confianca: 0.5, leitura_segura: true, motivo: null };
    expect(applyConfidenceThreshold(reading).leitura_segura).toBe(false);
  });

  it("derruba leitura_segura quando não há data_vencimento", () => {
    const reading = { data_vencimento: null, confianca: 0.95, leitura_segura: true, motivo: null };
    expect(applyConfidenceThreshold(reading).leitura_segura).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar os testes pra confirmar que falham**

Run: `npx vitest run lib/ai/crlv-ocr.test.ts`
Expected: FAIL com "Cannot find module './crlv-ocr'"

- [ ] **Step 3: Implementar `lib/ai/crlv-ocr.ts`**

```typescript
import { z } from "zod";
import { getVisionClient, getVisionModel } from "@/lib/ai/vision-client";
import { renderFirstPageToPng } from "@/lib/ai/pdf-render";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const CrlvReadingSchema = z.object({
  data_vencimento: z.string().regex(DATE_RE).nullable(),
  confianca: z.number().min(0).max(1),
  leitura_segura: z.boolean(),
  motivo: z.string().nullable(),
});

export type CrlvReading = z.infer<typeof CrlvReadingSchema>;

const FALLBACK_READING: CrlvReading = {
  data_vencimento: null,
  confianca: 0,
  leitura_segura: false,
  motivo: "IA não conseguiu ler o documento. Confira manualmente.",
};

const CONFIDENCE_THRESHOLD = 0.7;

// Aplica o mesmo limiar de confiança do hodômetro (lib/ai/odometer.ts): a IA
// pode dizer "leitura_segura=true" mas com confiança baixa, ou vice-versa —
// aqui a decisão final é sempre nossa, não do modelo.
export function applyConfidenceThreshold(reading: CrlvReading): CrlvReading {
  const leituraSegura =
    reading.leitura_segura && reading.confianca >= CONFIDENCE_THRESHOLD && reading.data_vencimento != null;
  return { ...reading, leitura_segura: leituraSegura };
}

const SYSTEM_PROMPT = `Você é um especialista em ler CRLV (Certificado de Registro e Licenciamento de Veículo) brasileiro, incluindo o modelo digital CRLV-e.

TAREFA: Localizar a DATA DE VENCIMENTO/VALIDADE do licenciamento — o campo costuma aparecer como "Válido até", "Data Máxima de Licenciamento", "Vencimento" ou "Exercício" (nesse último caso, o vencimento é 31/12 do ano indicado).

REGRAS:
• Ignore datas de emissão, nascimento do proprietário, ou datas de outros documentos que apareçam na mesma página.
• Se houver mais de uma data candidata, prefira a que estiver explicitamente rotulada como vencimento/validade/licenciamento.
• Retorne a data no formato YYYY-MM-DD.
• Se não conseguir identificar a data com segurança, retorne data_vencimento=null e leitura_segura=false.

REGRAS DE CONFIANÇA:
• confianca >= 0.9: campo claramente rotulado e legível.
• confianca 0.7-0.89: legível mas com alguma dúvida (leve borrão, ângulo).
• confianca < 0.7: dúvida real — marque leitura_segura=false.

Retorne APENAS um JSON válido (sem texto extra) seguindo este schema:
{
  "data_vencimento": "YYYY-MM-DD" | null,
  "confianca": number (0.0 a 1.0),
  "leitura_segura": boolean,
  "motivo": string | null
}`.trim();

export async function readCrlvVencimento(pdfBuffer: Buffer): Promise<CrlvReading> {
  const client = getVisionClient();
  if (!client) {
    return { ...FALLBACK_READING, motivo: "IA não configurada. Confira o vencimento manualmente." };
  }

  try {
    const png = await renderFirstPageToPng(pdfBuffer);
    const imageUrl = `data:image/png;base64,${png.toString("base64")}`;

    const response = await client.chat.completions.create({
      model: getVisionModel(),
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Leia este CRLV e extraia a data de vencimento do licenciamento." },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("[ai/crlv-ocr] resposta vazia");
      return FALLBACK_READING;
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[ai/crlv-ocr] JSON não encontrado", content.slice(0, 200));
      return FALLBACK_READING;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.warn("[ai/crlv-ocr] JSON inválido", err);
      return FALLBACK_READING;
    }

    const result = CrlvReadingSchema.safeParse(parsedJson);
    if (!result.success) {
      console.warn("[ai/crlv-ocr] schema inválido", result.error.issues);
      return FALLBACK_READING;
    }

    return applyConfidenceThreshold(result.data);
  } catch (error) {
    const err = error as { status?: number; message?: string; code?: string; name?: string };
    console.error("[ai/crlv-ocr] FALHA na chamada de visão:", {
      name: err.name,
      message: err.message,
      status: err.status,
      code: err.code,
      model: getVisionModel(),
    });
    return FALLBACK_READING;
  }
}
```

- [ ] **Step 4: Rodar os testes de novo**

Run: `npx vitest run lib/ai/crlv-ocr.test.ts`
Expected: PASS (8 testes)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: sem erros

- [ ] **Step 6: Commit**

```bash
git add lib/ai/crlv-ocr.ts lib/ai/crlv-ocr.test.ts
git commit -m "feat: adiciona leitura de vencimento do CRLV por IA de visão"
```

---

### Task 4: Migration — colunas de rastreio da leitura por IA

**Files:**
- Create: `supabase/migrations/20260818140000_add_crlv_ia_tracking.sql`

**Interfaces:**
- Produces: colunas `documents.crlv_vencimento_origem`, `documents.crlv_vencimento_confianca`, `documents.crlv_revisar_manualmente` — usadas pelas Tasks 5, 6, 7, 8.

- [ ] **Step 1: Criar a migration**

```sql
-- A data de vencimento do CRLV (documents.crlv_vencimento) era só digitada
-- manualmente por quem fazia o upload — sem nenhuma verificação contra o
-- documento real. Agora a IA lê o PDF e preenche essa data quando consegue
-- ler com confiança; essas colunas registram a origem/confiança da leitura e
-- sinalizam quando precisa de conferência humana.

alter table public.documents
  add column if not exists crlv_vencimento_origem text check (crlv_vencimento_origem in ('MANUAL', 'IA')),
  add column if not exists crlv_vencimento_confianca numeric,
  add column if not exists crlv_revisar_manualmente boolean not null default false;
```

- [ ] **Step 2: Aplicar a migration no banco de desenvolvimento**

Run: `npx supabase db push` (ou o comando de migração já usado no projeto — confira `README.md`/`docs` se houver um script `db:migrate`; se não houver, aplique via painel do Supabase ou `psql` apontando pra `SUPABASE_MANUTENCAO_URL`)

Expected: migration aplicada sem erro, `documents` com as 3 colunas novas (confira com `select column_name from information_schema.columns where table_name = 'documents';`)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260818140000_add_crlv_ia_tracking.sql
git commit -m "feat: adiciona colunas de rastreio da leitura de CRLV por IA"
```

---

### Task 5: Tipos e repositório — novas colunas

**Files:**
- Modify: `lib/repos/manutencao/types.ts:76-88` (`DocumentRecord`)
- Modify: `lib/repos/manutencao/documents.ts:9-14` (`DocumentUpsertInput`)

**Interfaces:**
- Consumes: colunas da Task 4.
- Produces: `DocumentRecord` e `DocumentUpsertInput` com os 3 campos novos, tipados — usados pelas Tasks 6 e 7.

- [ ] **Step 1: Atualizar `DocumentRecord` em `lib/repos/manutencao/types.ts`**

```typescript
export interface DocumentRecord {
  id: string;
  frota: string;
  placa: string;
  modelo: string;
  dut_url: string | null;
  crlv_url: string | null;
  dut_vencimento: string | null;
  crlv_vencimento: string | null;
  crlv_vencimento_origem: "MANUAL" | "IA" | null;
  crlv_vencimento_confianca: number | null;
  crlv_revisar_manualmente: boolean;
  created_at: string;
  created_by: string | null;
  updated_at?: string | null;
}
```

(`DocumentRecordWithSignedUrls` logo abaixo não muda — já faz `extends DocumentRecord`.)

- [ ] **Step 2: Atualizar `DocumentUpsertInput` em `lib/repos/manutencao/documents.ts`**

```typescript
export type DocumentUpsertInput = Pick<DocumentRecord, "frota" | "placa" | "modelo"> & {
  dut_url?: string | null;
  crlv_url?: string | null;
  dut_vencimento?: string | null;
  crlv_vencimento?: string | null;
  crlv_vencimento_origem?: "MANUAL" | "IA" | null;
  crlv_vencimento_confianca?: number | null;
  crlv_revisar_manualmente?: boolean;
};
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: sem erros (nenhum outro código quebra, já que os campos novos são opcionais)

- [ ] **Step 4: Commit**

```bash
git add lib/repos/manutencao/types.ts lib/repos/manutencao/documents.ts
git commit -m "feat: adiciona campos de rastreio de IA aos tipos de documentos"
```

---

### Task 6: Decisão pura de resolução do vencimento (testável isoladamente)

**Files:**
- Create: `lib/ai/resolve-crlv-vencimento.ts`
- Create: `lib/ai/resolve-crlv-vencimento.test.ts`

**Interfaces:**
- Consumes: `type CrlvReading` (Task 3).
- Produces: `resolveCrlvVencimento(reading: CrlvReading, manualDate: string | null): { crlv_vencimento: string | null; crlv_vencimento_origem: "MANUAL" | "IA" | null; crlv_vencimento_confianca: number | null; crlv_revisar_manualmente: boolean }` — usado pela Task 7 (action de upload) e Task 8 (script de backfill).

- [ ] **Step 1: Escrever o teste**

```typescript
// lib/ai/resolve-crlv-vencimento.test.ts
import { describe, expect, it } from "vitest";
import { resolveCrlvVencimento } from "./resolve-crlv-vencimento";
import type { CrlvReading } from "./crlv-ocr";

function reading(overrides: Partial<CrlvReading> = {}): CrlvReading {
  return {
    data_vencimento: "2026-05-15",
    confianca: 0.95,
    leitura_segura: true,
    motivo: null,
    ...overrides,
  };
}

describe("resolveCrlvVencimento", () => {
  it("usa a data da IA quando a leitura é segura, mesmo com data manual diferente", () => {
    const result = resolveCrlvVencimento(reading(), "2025-01-01");
    expect(result).toEqual({
      crlv_vencimento: "2026-05-15",
      crlv_vencimento_origem: "IA",
      crlv_vencimento_confianca: 0.95,
      crlv_revisar_manualmente: false,
    });
  });

  it("mantém a data manual e marca revisão quando a leitura não é segura", () => {
    const result = resolveCrlvVencimento(
      reading({ leitura_segura: false, confianca: 0.3, data_vencimento: null }),
      "2025-01-01"
    );
    expect(result).toEqual({
      crlv_vencimento: "2025-01-01",
      crlv_vencimento_origem: "MANUAL",
      crlv_vencimento_confianca: 0.3,
      crlv_revisar_manualmente: true,
    });
  });

  it("marca origem null quando a leitura falha e não há data manual", () => {
    const result = resolveCrlvVencimento(
      reading({ leitura_segura: false, confianca: 0, data_vencimento: null }),
      null
    );
    expect(result).toEqual({
      crlv_vencimento: null,
      crlv_vencimento_origem: null,
      crlv_vencimento_confianca: 0,
      crlv_revisar_manualmente: true,
    });
  });
});
```

- [ ] **Step 2: Rodar o teste pra confirmar que falha**

Run: `npx vitest run lib/ai/resolve-crlv-vencimento.test.ts`
Expected: FAIL com "Cannot find module './resolve-crlv-vencimento'"

- [ ] **Step 3: Implementar**

```typescript
// lib/ai/resolve-crlv-vencimento.ts
import type { CrlvReading } from "./crlv-ocr";

export type CrlvVencimentoResolvido = {
  crlv_vencimento: string | null;
  crlv_vencimento_origem: "MANUAL" | "IA" | null;
  crlv_vencimento_confianca: number | null;
  crlv_revisar_manualmente: boolean;
};

// Decide qual data de vencimento gravar: a lida pela IA (quando confiável,
// prevalece sobre o que foi digitado — é a fonte real do documento) ou a
// digitada manualmente (quando a IA não conseguiu ler com segurança).
export function resolveCrlvVencimento(reading: CrlvReading, manualDate: string | null): CrlvVencimentoResolvido {
  if (reading.leitura_segura && reading.data_vencimento) {
    return {
      crlv_vencimento: reading.data_vencimento,
      crlv_vencimento_origem: "IA",
      crlv_vencimento_confianca: reading.confianca,
      crlv_revisar_manualmente: false,
    };
  }

  return {
    crlv_vencimento: manualDate,
    crlv_vencimento_origem: manualDate ? "MANUAL" : null,
    crlv_vencimento_confianca: reading.confianca,
    crlv_revisar_manualmente: true,
  };
}
```

- [ ] **Step 4: Rodar o teste de novo**

Run: `npx vitest run lib/ai/resolve-crlv-vencimento.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: sem erros

- [ ] **Step 6: Commit**

```bash
git add lib/ai/resolve-crlv-vencimento.ts lib/ai/resolve-crlv-vencimento.test.ts
git commit -m "feat: adiciona lógica de resolução do vencimento de CRLV (IA vs manual)"
```

---

### Task 7: Wiring no upload — `app/(app)/documentos/_actions.ts`

**Files:**
- Modify: `app/(app)/documentos/_actions.ts:39-115` (`createDocumentAction`), `:117-160` (`updateDocumentAction`)

**Interfaces:**
- Consumes: `readCrlvVencimento(pdfBuffer: Buffer): Promise<CrlvReading>` (Task 3), `resolveCrlvVencimento(reading, manualDate)` (Task 6).

- [ ] **Step 1: Adicionar os imports no topo do arquivo**

```typescript
import { readCrlvVencimento } from "@/lib/ai/crlv-ocr";
import { resolveCrlvVencimento } from "@/lib/ai/resolve-crlv-vencimento";
```

- [ ] **Step 2: Em `createDocumentAction`, ler o CRLV antes de montar os dados a salvar**

Logo após a linha `await validatePdfFile(dutFile, "DUT"); await validatePdfFile(crlvFile, "CRLV");` e antes de `validateAggregateFileSize(...)`, adicionar:

```typescript
const crlvResolved = crlvFile
  ? resolveCrlvVencimento(
      await readCrlvVencimento(Buffer.from(await crlvFile.arrayBuffer())),
      input.crlv_vencimento
    )
  : {
      crlv_vencimento: input.crlv_vencimento,
      crlv_vencimento_origem: input.crlv_vencimento ? ("MANUAL" as const) : null,
      crlv_vencimento_confianca: null,
      crlv_revisar_manualmente: false,
    };
```

No branch de documento já existente (`if (existing) { ... }`), trocar a chamada a `updateDocument`:

```typescript
await updateDocument(existing.id, {
  modelo: input.modelo,
  placa,
  dut_url: replacement.dut_url,
  crlv_url: replacement.crlv_url,
  dut_vencimento: input.dut_vencimento,
  ...crlvResolved,
});
```

No branch de criação (`await createDocument(...)`), trocar:

```typescript
await createDocument(
  {
    ...input,
    placa,
    dut_url: dutPath,
    crlv_url: crlvPath,
    ...crlvResolved,
  },
  user.email
);
```

- [ ] **Step 3: Aplicar a mesma leitura em `updateDocumentAction`**

Logo após `await validatePdfFile(dutFile, "DUT"); await validatePdfFile(crlvFile, "CRLV");` e antes de `validateAggregateFileSize(...)`:

```typescript
const crlvResolved = crlvFile
  ? resolveCrlvVencimento(
      await readCrlvVencimento(Buffer.from(await crlvFile.arrayBuffer())),
      input.crlv_vencimento ?? current.crlv_vencimento
    )
  : undefined;
```

Na chamada a `updateDocument(id, {...})`, trocar:

```typescript
await updateDocument(id, {
  ...input,
  placa: input.placa ? normalizePlate(input.placa) : undefined,
  dut_url: replacement.dut_url,
  crlv_url: replacement.crlv_url,
  ...crlvResolved,
});
```

(Quando não há `crlvFile` novo, `crlvResolved` é `undefined` e o spread não sobrescreve nada — mantém o comportamento atual de update parcial.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: sem erros

- [ ] **Step 5: Rodar a suíte inteira de testes**

Run: `npx vitest run`
Expected: PASS (todos os testes existentes + os novos das Tasks 2, 3, 6)

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/documentos/_actions.ts
git commit -m "feat: lê vencimento do CRLV por IA no upload da Central de Documentos"
```

---

### Task 8: Badge "Revisar CRLV" na Central de Documentos

**Files:**
- Modify: `components/documentos/documentos-workspace.tsx:225-230` (célula CRLV da tabela desktop)

**Interfaces:**
- Consumes: `doc.crlv_revisar_manualmente` (campo de `DocumentRecordWithSignedUrls`, Task 5).

- [ ] **Step 1: Adicionar o badge junto ao `VencimentoLabel` do CRLV**

Trocar:

```typescript
                <TableCell>
                  <div className="space-y-1">
                    <DocumentActions signedUrl={doc.crlv_signed_url} downloadUrl={doc.crlv_download_url} label="CRLV" />
                    <VencimentoLabel value={doc.crlv_vencimento} />
                  </div>
                </TableCell>
```

por:

```typescript
                <TableCell>
                  <div className="space-y-1">
                    <DocumentActions signedUrl={doc.crlv_signed_url} downloadUrl={doc.crlv_download_url} label="CRLV" />
                    <VencimentoLabel value={doc.crlv_vencimento} />
                    {doc.crlv_revisar_manualmente ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                        Revisar CRLV
                      </span>
                    ) : null}
                  </div>
                </TableCell>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: sem erros

- [ ] **Step 3: Verificação manual**

Rode `npm run dev`, abra `/documentos`, e confirme visualmente que a coluna CRLV renderiza normalmente pra documentos sem `crlv_revisar_manualmente` (a maioria, já que a coluna é `false` por padrão) — sem o badge quebrar o layout.

- [ ] **Step 4: Commit**

```bash
git add components/documentos/documentos-workspace.tsx
git commit -m "feat: exibe badge de revisão manual quando IA não lê o CRLV com confiança"
```

---

### Task 9: Script de backfill dos CRLVs existentes

**Files:**
- Create: `scripts/backfill-crlv-ocr.ts`
- Modify: `package.json` (novo script `backfill:crlv`)

**Interfaces:**
- Consumes: `readCrlvVencimento` (Task 3), `resolveCrlvVencimento` (Task 6), `supabaseManutencao` (`lib/supabase-manutencao.ts`).

- [ ] **Step 1: Implementar o script**

```typescript
// scripts/backfill-crlv-ocr.ts
//
// Roda a leitura de CRLV por IA sobre todos os documentos já cadastrados na
// Central de Documentos, corrigindo a data de vencimento digitada manualmente
// (ou preenchendo quando estava vazia). Uso: npx tsx scripts/backfill-crlv-ocr.ts
import "dotenv/config";
import { supabaseManutencao } from "../lib/supabase-manutencao";
import { readCrlvVencimento } from "../lib/ai/crlv-ocr";
import { resolveCrlvVencimento } from "../lib/ai/resolve-crlv-vencimento";

const DOCUMENTS_BUCKET = "documents";

type DocumentoParaBackfill = {
  id: string;
  frota: string;
  crlv_url: string | null;
  crlv_vencimento: string | null;
};

async function listarDocumentosComCrlv(): Promise<DocumentoParaBackfill[]> {
  const { data, error } = await supabaseManutencao
    .from("documents")
    .select("id,frota,crlv_url,crlv_vencimento")
    .not("crlv_url", "is", null);
  if (error) throw new Error(`Erro ao listar documentos: ${error.message}`);
  return (data ?? []) as DocumentoParaBackfill[];
}

async function baixarCrlv(path: string): Promise<Buffer | null> {
  const { data, error } = await supabaseManutencao.storage.from(DOCUMENTS_BUCKET).download(path);
  if (error || !data) {
    console.error(`  falha ao baixar ${path}: ${error?.message ?? "sem dados"}`);
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}

async function main() {
  const documentos = await listarDocumentosComCrlv();
  console.log(`${documentos.length} documento(s) com CRLV encontrados.`);

  let atualizados = 0;
  let paraRevisao = 0;
  let falhasDownload = 0;

  for (const doc of documentos) {
    if (!doc.crlv_url) continue;

    const buffer = await baixarCrlv(doc.crlv_url);
    if (!buffer) {
      falhasDownload += 1;
      continue;
    }

    const reading = await readCrlvVencimento(buffer);
    const resolved = resolveCrlvVencimento(reading, doc.crlv_vencimento);

    const { error } = await supabaseManutencao.from("documents").update(resolved).eq("id", doc.id);
    if (error) {
      console.error(`  frota ${doc.frota}: falha ao atualizar — ${error.message}`);
      continue;
    }

    if (resolved.crlv_vencimento_origem === "IA") {
      atualizados += 1;
      console.log(`  frota ${doc.frota}: OK — vencimento ${resolved.crlv_vencimento} (confiança ${reading.confianca})`);
    } else {
      paraRevisao += 1;
      console.log(`  frota ${doc.frota}: marcado para revisão manual (${reading.motivo ?? "confiança baixa"})`);
    }
  }

  console.log("\n--- Resumo ---");
  console.log(`Atualizados pela IA: ${atualizados}`);
  console.log(`Marcados para revisão manual: ${paraRevisao}`);
  console.log(`Falhas de download: ${falhasDownload}`);
}

main().catch((error) => {
  console.error("Backfill falhou:", error);
  process.exit(1);
});
```

- [ ] **Step 2: Registrar o script no `package.json`**

Em `"scripts"`, adicionar:

```json
"backfill:crlv": "tsx scripts/backfill-crlv-ocr.ts"
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-crlv-ocr.ts package.json
git commit -m "feat: adiciona script de backfill da leitura de CRLV por IA"
```

---

### Task 10: Rodar o backfill (manual, fora do ciclo normal de dev)

Este passo não é código — é a execução real contra o banco de produção/homologação, feita por quem tem as credenciais (`SUPABASE_MANUTENCAO_URL`, `SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY`, `AZURE_OPENAI_*`/`OPENAI_API_KEY` no `.env`).

- [ ] **Step 1: Teste num subconjunto pequeno primeiro**

Antes de rodar nos 176, comente temporariamente o `for` em `main()` pra processar só os 5-10 primeiros documentos (`documentos.slice(0, 10)`), rode `npx tsx scripts/backfill-crlv-ocr.ts`, e confira manualmente (abrindo os PDFs correspondentes em `/documentos`) se as datas extraídas batem com o que está escrito no CRLV.

- [ ] **Step 2: Reverter o `.slice` e rodar o backfill completo**

```bash
npm run backfill:crlv
```

- [ ] **Step 3: Conferir o resumo impresso no final**

Anotar quantos foram atualizados pela IA vs quantos foram para revisão manual — os que foram para revisão aparecem com o badge "Revisar CRLV" em `/documentos` (Task 8), prontos pra alguém conferir manualmente.
