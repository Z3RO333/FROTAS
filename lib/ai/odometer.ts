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

const KM_MAX_VARIACAO_TURNO = 1200;

export function calcStatusLeitura(
  reading: OdometerReading,
  kmAnterior: number | null
): StatusLeitura {
  if (reading.km_lido == null) return "LEITURA_FALHOU";

  if (kmAnterior == null || kmAnterior <= 0) {
    if (reading.confianca >= 0.8 && reading.leitura_segura) return "LEITURA_SEGURA";
    if (reading.confianca >= 0.5) return "LEITURA_SUSPEITA";
    return "LEITURA_FALHOU";
  }

  const diff = reading.km_lido - kmAnterior;
  if (diff < 0) return "LEITURA_DIVERGENTE";
  if (kmAnterior > 10_000 && reading.km_lido < kmAnterior * 0.6) return "LEITURA_DIVERGENTE";
  if (diff > KM_MAX_VARIACAO_TURNO) return "LEITURA_SUSPEITA";
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
  candidatos_descartados: [],
  regiao_detectada: "desconhecido",
};

// ------- Cliente OpenAI / Azure OpenAI -------

let client: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (client) return client;

  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const azureKey = process.env.AZURE_OPENAI_API_KEY?.trim();

  if (azureEndpoint && azureKey) {
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
  return (
    process.env.AZURE_OPENAI_VISION_DEPLOYMENT ??
    process.env.OPENAI_VISION_MODEL ??
    "gpt-4.1-mini"
  );
}

// ------- Pré-processamento de imagem -------
// Reduz a imagem para no máximo 800px de largura antes de enviar para a IA.
// Isso reduz o número de tiles de "high detail" de ~20 para 1-2,
// caindo de ~3000 tokens para ~170 tokens — muito mais rápido.

async function resizeImageForOcr(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";

  // Tenta redimensionar via sharp se disponível; caso contrário manda original
  try {
    const sharp = await import("sharp").catch(() => null);
    if (sharp) {
      const resized = await sharp.default(buffer)
        .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      return `data:image/jpeg;base64,${resized.toString("base64")}`;
    }
  } catch {
    // sharp não disponível — usa imagem original
  }

  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

// ------- Prompt especializado para painel de caminhão -------

const SYSTEM_PROMPT = `Você é um especialista em leitura de hodômetro de caminhões pesados brasileiros (Mercedes-Benz Accelo/Atego, Volkswagen Constellation/Delivery, Iveco Daily/Tector, Ford Cargo, Volvo FH, Scania).

TAREFA: Localizar e ler o HODÔMETRO (odômetro) — o contador de QUILÔMETROS TOTAIS acumulados desde a fábrica.

COMO IDENTIFICAR O HODÔMETRO:
• É um número de 5-7 dígitos (geralmente 100.000 a 999.999 km para frotas em uso)
• Aparece no display digital central ou no cluster de instrumentos
• Pode estar acompanhado das letras "ODO", "KM" ou sem label
• Formato: "303262" ou "303.262" ou "303 262"

O QUE NÃO É O HODÔMETRO (DESCARTE ESSES VALORES):
• Velocímetro analógico: o mostrador redondo grande com agulha (0-140, 0-160, 0-200 km/h) — NÃO leia a escala
• Velocidade atual digital: número pequeno no display mostrando velocidade momentânea (ex: "0", "45", "80")
• Trip/Viagem: distância percorrida no turno, muito menor que o hodômetro (ex: "127.4", "0.0", "452")
• Rotação (RPM): números como "1200", "800", "2500" no tacômetro
• Hora/Relógio: formato "14:32" ou "8:05"
• Temperatura: números como "85°", "92°"

REGRAS DE CONFIANÇA:
• confianca = 1.0: número claramente visível, sem ambiguidade, típico para frota (100k-600k km)
• confianca = 0.8: visível mas com pequena dúvida (reflexo leve, ângulo)
• confianca < 0.7: muita dúvida — marque leitura_segura=false
• Se leu um número < 50.000 para um caminhão de frota → muito provável erro, reduza confiança

Retorne km_lido como INTEGER (sem pontos, vírgulas ou espaços).`.trim();

// ------- API pública -------

export async function analyzeOdometerImage(file: File): Promise<OdometerReading> {
  const yoloReading = await analyzeOdometerWithYoloService(file);
  if (yoloReading?.leitura_segura) return yoloReading;

  const openai = getOpenAIClient();
  if (!openai) {
    return yoloReading ?? {
      ...FALLBACK_READING,
      motivo: "IA não configurada. Digite o KM manualmente.",
    };
  }

  try {
    // Redimensiona a imagem para acelerar a análise
    const imageUrl = await resizeImageForOcr(file);

    const response = await openai.responses.parse({
      model: getVisionModel(),
      input: [
        {
          role: "developer",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              // Few-shot via texto para guiar a resposta
              text: `Analise esta foto do painel do caminhão e extraia o hodômetro.

PASSO 1: Liste todos os números visíveis na imagem.
PASSO 2: Identifique qual é o hodômetro (maior número acumulado, geralmente >100.000 km).
PASSO 3: Descarte velocímetro, trip, RPM, hora. Liste como candidatos_descartados.
PASSO 4: Retorne km_lido como inteiro.

Se não conseguir identificar o hodômetro com clareza, retorne km_lido=null.`,
            },
            {
              type: "input_image",
              image_url: imageUrl,
              // "low" = 1 tile = 85 tokens = muito mais rápido
              // Suficiente para ler dígitos em display digital de caminhão
              detail: "low",
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

    // Heurística extra: se leu um número muito baixo (<10k) mas há KM anterior alto,
    // provavelmente foi o velocímetro ou trip
    const kmLido = parsed.km_lido;
    const confiancaFinal =
      kmLido != null && kmLido < 10_000
        ? Math.min(parsed.confianca, 0.3) // penaliza leituras suspeitas
        : parsed.confianca;

    return {
      ...parsed,
      confianca: confiancaFinal,
      leitura_segura: parsed.leitura_segura && confiancaFinal >= 0.7 && kmLido != null,
      precisa_digitacao_manual: parsed.precisa_digitacao_manual || confiancaFinal < 0.7 || kmLido == null,
    };
  } catch (error) {
    console.warn("[ai/odometer] falha ao analisar imagem:", error);
    return yoloReading ?? FALLBACK_READING;
  }
}

// ------- Serviço YOLO externo -------

async function analyzeOdometerWithYoloService(file: File): Promise<OdometerReading | null> {
  const endpoint = odometerEndpoint();
  if (!endpoint) return null;

  const formData = new FormData();
  formData.append("foto_km", file);

  const headers: Record<string, string> = {};
  const token = process.env.CHECKLIST_YOLO_TOKEN?.trim();
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const response = await fetch(endpoint, { method: "POST", headers, body: formData });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const msg = json?.detail ?? response.statusText;
      console.warn(`[yolo/odometer] falha: ${msg}`);
      return null;
    }
    return OdometerReadingSchema.parse(json);
  } catch {
    return null;
  }
}

function odometerEndpoint(): string | null {
  const explicit = process.env.CHECKLIST_ODOMETER_ENDPOINT?.trim();
  if (explicit) return explicit;

  const base = process.env.CHECKLIST_YOLO_ENDPOINT?.trim();
  if (!base) return null;
  if (base.endsWith("/inspect")) return base.replace(/\/inspect$/, "/odometer");
  return `${base.replace(/\/$/, "")}/odometer`;
}
