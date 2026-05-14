import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const OdometerReadingSchema = z.object({
  km_lido: z.number().int().nonnegative().nullable(),
  confianca: z.number().min(0).max(1),
  leitura_segura: z.boolean(),
  precisa_digitacao_manual: z.boolean(),
  motivo: z.string().nullable(),
  texto_visivel: z.string().nullable(),
  observacoes_imagem: z.string().nullable(),
});

export type OdometerReading = z.infer<typeof OdometerReadingSchema>;

const FALLBACK_READING: OdometerReading = {
  km_lido: null,
  confianca: 0,
  leitura_segura: false,
  precisa_digitacao_manual: true,
  motivo: "OCR/IA indisponível. Digite o KM manualmente.",
  texto_visivel: null,
  observacoes_imagem: null,
};

let client: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  client ??= new OpenAI({ apiKey });
  return client;
}

export async function analyzeOdometerImage(file: File): Promise<OdometerReading> {
  const openai = getOpenAIClient();
  if (!openai) return FALLBACK_READING;

  try {
    const imageUrl = await fileToDataUrl(file);
    const response = await openai.responses.parse({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "developer",
          content:
            "Você extrai quilometragem de fotos de painel/hodômetro para checklist de frotas. Responda apenas com o JSON do schema. Não invente números. Se houver dúvida, marque leitura_segura=false.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Leia a quilometragem atual desta foto. Retorne km_lido como inteiro sem pontos ou vírgulas. Use confianca entre 0 e 1. Se a imagem estiver escura, cortada, com reflexo, ambígua ou sem hodômetro legível, retorne km_lido=null e precisa_digitacao_manual=true.",
            },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(OdometerReadingSchema, "odometer_reading"),
      },
    });

    const parsed = response.output_parsed;
    if (!parsed) return FALLBACK_READING;

    return {
      ...parsed,
      leitura_segura: parsed.leitura_segura && parsed.confianca >= 0.8 && parsed.km_lido != null,
      precisa_digitacao_manual:
        parsed.precisa_digitacao_manual || parsed.confianca < 0.8 || parsed.km_lido == null,
    };
  } catch (error) {
    console.warn("[ai] falha ao ler hodômetro", error);
    return FALLBACK_READING;
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
