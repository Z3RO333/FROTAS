// Analise de imagens de checklist usando OpenAI Vision (Azure OpenAI ou direto).
// O nome do arquivo "yolo.ts" e mantido por compat de imports — o YOLO foi removido,
// agora roda GPT vision via OpenAI/Azure (mesma chave do AZURE_OPENAI_* / OPENAI_API_KEY).
import OpenAI from "openai";
import { z } from "zod";
import type { ChecklistImageInspection } from "@/lib/repos/checklist-images";

const DetectionSchema = z.object({
  class_name: z.string(),
  confidence: z.number().min(0).max(1),
  description: z.string().nullable().optional(),
  box: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable()
    .optional(),
});

const VisionResponseSchema = z.object({
  model_name: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  summary: z.string().nullable().optional(),
  detections: z.array(DetectionSchema).default([]),
});

export type YoloChecklistResult = z.infer<typeof VisionResponseSchema>;

const client: OpenAI | null = (() => {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const azureKey = process.env.AZURE_OPENAI_API_KEY?.trim();

  if (azureEndpoint && azureKey) {
    return new OpenAI({
      apiKey: azureKey,
      baseURL: `${azureEndpoint.replace(/\/$/, "")}/openai`,
      defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION ?? "2025-04-01-preview" },
      defaultHeaders: { "api-key": azureKey },
      timeout: 30_000,
      maxRetries: 1,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });
})();

function getVisionModel(): string {
  return (
    process.env.AZURE_OPENAI_VISION_DEPLOYMENT ??
    process.env.OPENAI_VISION_MODEL ??
    "gpt-4o"
  );
}

const SOURCE_PROMPTS: Record<string, { instrucao: string; foco: string }> = {
  hodometro: {
    instrucao: "Analise se a foto mostra claramente um hodometro com numero legivel.",
    foco: "legibilidade dos digitos, presenca de obstrucao ou reflexo",
  },
  item: {
    instrucao:
      "Analise foto de item de checklist de caminhao (pneu, freio, extintor, cinto, farol, etc) e identifique problemas visiveis.",
    foco:
      "desgaste, dano fisico, vazamento, falta de equipamento, sujeira excessiva, ou condicao normal",
  },
  abastecimento: {
    instrucao: "Analise se a foto mostra comprovante de abastecimento ou bomba de combustivel.",
    foco: "presenca de litros, valor, tipo de combustivel, ou se imagem nao corresponde",
  },
};

function buildPrompt(sourceType: string, itemCodigo: string | null): string {
  const cfg = SOURCE_PROMPTS[sourceType] ?? SOURCE_PROMPTS.item;
  return `Voce e um especialista em inspecao visual de caminhoes pesados da frota Bemol.

${cfg.instrucao}${itemCodigo ? ` Item especifico: ${itemCodigo}.` : ""}

FOCO: ${cfg.foco}.

Retorne APENAS um JSON valido seguindo este schema (sem texto extra):
{
  "model_name": "gpt-vision",
  "confidence": 0.0 a 1.0,
  "summary": "1-2 frases descrevendo o que voce ve",
  "detections": [
    {
      "class_name": "categoria_em_snake_case",
      "confidence": 0.0 a 1.0,
      "description": "descricao curta do problema"
    }
  ]
}

REGRAS:
- Se a foto estiver OK, retorne detections=[] e summary descrevendo o estado normal.
- Se houver problemas, liste cada um (ex: "pneu_careca", "vazamento_oleo", "extintor_vencido", "para_brisa_trincado").
- NUNCA invente problemas que nao estao visiveis.
- Se foto borrada/escura/ilegivel, marque confidence < 0.5 e summary explicando.`;
}

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Falha ao baixar imagem (${response.status} ${response.statusText})`);
  }
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());

  try {
    const sharp = await import("sharp").catch(() => null);
    if (sharp) {
      const resized = await sharp
        .default(buffer)
        .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      return `data:image/jpeg;base64,${resized.toString("base64")}`;
    }
  } catch {
    // sharp indisponivel — usa imagem original
  }
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export async function analyzeChecklistImageWithYolo(args: {
  inspection: ChecklistImageInspection;
  imageUrl: string;
}): Promise<YoloChecklistResult> {
  if (!client) {
    throw new Error("IA nao configurada (AZURE_OPENAI_* ou OPENAI_API_KEY).");
  }

  const imageDataUrl = await imageUrlToDataUrl(args.imageUrl);
  const model = getVisionModel();
  const prompt = buildPrompt(args.inspection.source_type, args.inspection.checklist_item_codigo);

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI retornou resposta vazia.");
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Resposta sem JSON: ${content.slice(0, 200)}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(`Falha ao parsear JSON: ${(err as Error).message}`);
  }

  if (typeof raw === "object" && raw !== null) {
    (raw as Record<string, unknown>).model_name = model;
  }

  return VisionResponseSchema.parse(raw);
}
