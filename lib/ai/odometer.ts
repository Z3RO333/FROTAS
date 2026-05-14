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
  motivo: "OCR/IA indisponivel. Digite o KM manualmente.",
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
  const yoloReading = await analyzeOdometerWithYoloService(file);
  if (yoloReading?.leitura_segura) return yoloReading;

  const openai = getOpenAIClient();
  if (!openai) {
    return yoloReading ?? {
      ...FALLBACK_READING,
      motivo:
        "Servico YOLO/OCR nao conseguiu ler o painel e OPENAI_API_KEY nao esta configurada para fallback.",
    };
  }

  try {
    const imageUrl = await fileToDataUrl(file);
    const response = await openai.responses.parse({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "developer",
          content:
            "Voce extrai quilometragem de fotos de painel/hodometro para checklist de frotas. Responda apenas com o JSON do schema. Nao invente numeros. Se houver duvida, marque leitura_segura=false.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Leia a quilometragem atual desta foto de painel de veiculo. Procure o hodometro/odometro, nao leia velocidade, horario, temperatura ou viagem parcial. Retorne km_lido como inteiro sem pontos ou virgulas. Use confianca entre 0 e 1. Se a imagem estiver escura, cortada, com reflexo, ambigua ou sem hodometro legivel, retorne km_lido=null e precisa_digitacao_manual=true.",
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
    if (!parsed) return yoloReading ?? FALLBACK_READING;

    return {
      ...parsed,
      leitura_segura: parsed.leitura_segura && parsed.confianca >= 0.7 && parsed.km_lido != null,
      precisa_digitacao_manual:
        parsed.precisa_digitacao_manual || parsed.confianca < 0.7 || parsed.km_lido == null,
    };
  } catch (error) {
    console.warn("[ai] falha ao ler hodometro", error);
    return yoloReading ?? FALLBACK_READING;
  }
}

async function analyzeOdometerWithYoloService(file: File): Promise<OdometerReading | null> {
  const endpoint = odometerEndpoint();
  if (!endpoint) return null;

  const formData = new FormData();
  formData.append("foto_km", file);

  const headers: Record<string, string> = {};
  const token = process.env.CHECKLIST_YOLO_TOKEN?.trim();
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: formData,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const message = json && typeof json === "object" && "detail" in json ? String(json.detail) : response.statusText;
      console.warn(`[yolo/odometer] falha: ${message}`);
      return null;
    }
    return OdometerReadingSchema.parse(json);
  } catch (error) {
    console.warn("[yolo/odometer] servico indisponivel", error);
    return null;
  }
}

function odometerEndpoint(): string | null {
  const explicit = process.env.CHECKLIST_ODOMETER_ENDPOINT?.trim();
  if (explicit) return explicit;

  const yoloEndpoint = process.env.CHECKLIST_YOLO_ENDPOINT?.trim();
  if (!yoloEndpoint) return null;
  if (yoloEndpoint.endsWith("/inspect")) return yoloEndpoint.replace(/\/inspect$/, "/odometer");
  return `${yoloEndpoint.replace(/\/$/, "")}/odometer`;
}

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
