import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

// ------- Schemas -------

const CandidatoDescartadoSchema = z.object({
  valor: z.number().int().nonnegative(),
  motivo: z.string(),
});

const OdometerReadingSchema = z.object({
  km_lido: z.number().int().nonnegative().nullable(),
  confianca: z.number().min(0).max(1),
  leitura_segura: z.boolean(),
  precisa_digitacao_manual: z.boolean(),
  motivo: z.string().nullable(),
  texto_visivel: z.string().nullable(),
  observacoes_imagem: z.string().nullable(),
  candidatos_descartados: z.array(CandidatoDescartadoSchema).default([]),
  regiao_detectada: z
    .enum(["hodometro_digital", "hodometro_analogico", "velocimetro", "display_central", "desconhecido"])
    .default("desconhecido"),
});

export type OdometerReading = z.infer<typeof OdometerReadingSchema>;

export type StatusLeitura =
  | "LEITURA_SEGURA"
  | "LEITURA_SUSPEITA"
  | "LEITURA_DIVERGENTE"
  | "LEITURA_FALHOU";

// Max km increase plausible in a single driver shift (~8h at highway speeds)
const KM_MAX_VARIACAO_TURNO = 1200;

export function calcStatusLeitura(
  reading: OdometerReading,
  kmAnterior: number | null
): StatusLeitura {
  if (reading.km_lido == null) return "LEITURA_FALHOU";

  if (kmAnterior == null || kmAnterior <= 0) {
    // No prior KM to cross-check — rely on OCR confidence alone
    if (reading.confianca >= 0.8 && reading.leitura_segura) return "LEITURA_SEGURA";
    if (reading.confianca >= 0.5) return "LEITURA_SUSPEITA";
    return "LEITURA_FALHOU";
  }

  const diff = reading.km_lido - kmAnterior;

  // Odometer never goes backwards
  if (diff < 0) return "LEITURA_DIVERGENTE";

  // OCR likely read speedometer/clock instead of odometer
  // e.g. km_anterior=303262, km_lido=160 or km_lido=160200 (partial digits)
  if (kmAnterior > 10_000 && reading.km_lido < kmAnterior * 0.6) return "LEITURA_DIVERGENTE";

  // Jump too large for a single shift
  if (diff > KM_MAX_VARIACAO_TURNO) return "LEITURA_SUSPEITA";

  // Low OCR confidence
  if (reading.confianca < 0.7) return "LEITURA_SUSPEITA";

  return "LEITURA_SEGURA";
}

// ------- Fallback -------

const FALLBACK_READING: OdometerReading = {
  km_lido: null,
  confianca: 0,
  leitura_segura: false,
  precisa_digitacao_manual: true,
  motivo: "OCR/IA indisponível. Digite o KM manualmente.",
  texto_visivel: null,
  observacoes_imagem: null,
  candidatos_descartados: [],
  regiao_detectada: "desconhecido",
};

// ------- OpenAI client (suporta Azure OpenAI e OpenAI padrão) -------

let client: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (client) return client;

  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const azureKey = process.env.AZURE_OPENAI_API_KEY?.trim();

  if (azureEndpoint && azureKey) {
    // Azure OpenAI — usa baseURL + defaultQuery para api-version
    client = new OpenAI({
      apiKey: azureKey,
      baseURL: `${azureEndpoint.replace(/\/$/, "")}/openai`,
      defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION ?? "2025-04-01-preview" },
      defaultHeaders: { "api-key": azureKey },
    });
    return client;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  client = new OpenAI({ apiKey });
  return client;
}

function getVisionModel(): string {
  // Azure usa o nome do deployment; OpenAI padrão usa o nome do modelo
  return (
    process.env.AZURE_OPENAI_VISION_DEPLOYMENT ??
    process.env.OPENAI_VISION_MODEL ??
    "gpt-4.1-mini"
  );
}

// ------- Public API -------

export async function analyzeOdometerImage(file: File): Promise<OdometerReading> {
  const yoloReading = await analyzeOdometerWithYoloService(file);
  if (yoloReading?.leitura_segura) return yoloReading;

  const openai = getOpenAIClient();
  if (!openai) {
    return yoloReading ?? {
      ...FALLBACK_READING,
      motivo:
        "Serviço YOLO/OCR não conseguiu ler o painel e OPENAI_API_KEY não está configurada para fallback.",
    };
  }

  try {
    const imageUrl = await fileToDataUrl(file);
    const response = await openai.responses.parse({
      model: getVisionModel(),
      input: [
        {
          role: "developer",
          content: [
            "Você extrai a quilometragem total (hodômetro/odômetro) de fotos de painel de veículos pesados (caminhões, ônibus) para checklist de frotas.",
            "REGRAS OBRIGATÓRIAS:",
            "1. Leia SOMENTE o hodômetro/odômetro — o contador de KM TOTAL acumulado.",
            "2. IGNORE: velocímetro (ex.: 0–160 km/h), viagem parcial (trip/km parcial), relógio/horário, temperatura, rotação (RPM).",
            "3. O hodômetro de caminhões geralmente exibe valores entre 50.000 e 999.999 km (seis dígitos). Se o número lido for menor que 10.000, quase certamente é outro instrumento — registre como candidato_descartado.",
            "4. Se houver múltiplos números visíveis, liste os outros como candidatos_descartados com o motivo do descarte (ex.: 'parece_velocimetro', 'viagem_parcial', 'horario').",
            "5. Retorne km_lido como inteiro sem pontos ou vírgulas.",
            "6. Se houver dúvida, marque leitura_segura=false e confianca < 0.7.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Analise esta foto do painel. Identifique e leia o hodômetro (KM total acumulado). Se a imagem estiver escura, cortada, com reflexo ou sem hodômetro legível, retorne km_lido=null.",
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
    console.warn("[ai] falha ao ler hodômetro", error);
    return yoloReading ?? FALLBACK_READING;
  }
}

// ------- YOLO service -------

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
      const message =
        json && typeof json === "object" && "detail" in json
          ? String(json.detail)
          : response.statusText;
      console.warn(`[yolo/odometer] falha: ${message}`);
      return null;
    }
    return OdometerReadingSchema.parse(json);
  } catch (error) {
    console.warn("[yolo/odometer] serviço indisponível", error);
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
