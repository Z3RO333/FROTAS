import OpenAI, { AzureOpenAI } from "openai";
import { z } from "zod";

// ------- Schemas -------

const CandidatoDescartadoSchema = z.object({
  // gpt-5-chat as vezes retorna float (45.0), normaliza pra int
  valor: z
    .number()
    .nonnegative()
    .transform((v) => Math.round(v)),
  motivo: z.string(),
});

const OdometerReadingSchema = z.object({
  // Aceita float (ex: 347185.0 do gpt-5-chat) e converte pra int via round
  km_lido: z
    .number()
    .nonnegative()
    .nullable()
    .transform((v) => (v == null ? null : Math.round(v))),
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
// Inicializado eager no module-level pra eliminar latência de cold-start

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

function getOpenAIClient(): OpenAI | null {
  return client;
}

// ------- Cache LRU simples por hash da imagem -------
// O mesmo motorista frequentemente refaz foto do mesmo painel.
// Cache de 5min evita chamadas duplicadas à IA.

const OCR_CACHE = new Map<string, { result: OdometerReading; expiresAt: number }>();
const OCR_CACHE_TTL_MS = 5 * 60 * 1000;
const OCR_CACHE_MAX_SIZE = 50;

async function hashBuffer(buffer: Buffer): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("md5").update(buffer).digest("hex");
}

function getCachedOcr(hash: string): OdometerReading | null {
  const entry = OCR_CACHE.get(hash);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    OCR_CACHE.delete(hash);
    return null;
  }
  return entry.result;
}

function setCachedOcr(hash: string, result: OdometerReading): void {
  // Evict mais antigo se ultrapassar tamanho máximo
  if (OCR_CACHE.size >= OCR_CACHE_MAX_SIZE) {
    const firstKey = OCR_CACHE.keys().next().value;
    if (firstKey) OCR_CACHE.delete(firstKey);
  }
  OCR_CACHE.set(hash, { result, expiresAt: Date.now() + OCR_CACHE_TTL_MS });
}

function getVisionModel(): string {
  return (
    process.env.AZURE_OPENAI_VISION_DEPLOYMENT ??
    process.env.OPENAI_VISION_MODEL ??
    "gpt-4o"
  );
}

// ------- Pré-processamento de imagem -------
// Reduz a imagem para no máximo 800px de largura antes de enviar para a IA.
// Isso reduz o número de tiles de "high detail" de ~20 para 1-2,
// caindo de ~3000 tokens para ~170 tokens — muito mais rápido.

async function resizeBufferForOcr(buffer: Buffer, mimeType: string | null): Promise<string> {
  const mt = mimeType || "image/jpeg";

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

  return `data:${mt};base64,${buffer.toString("base64")}`;
}

// ------- Prompt especializado para painel de caminhão -------

const SYSTEM_PROMPT = `Você é um especialista em leitura de hodômetro de caminhões pesados brasileiros (Mercedes-Benz Accelo/Atego, Volkswagen Constellation/Delivery, Iveco Daily/Tector, Ford Cargo, Volvo FH, Scania).

TAREFA: Localizar e ler o HODÔMETRO (odômetro) — o contador de QUILÔMETROS TOTAIS acumulados desde a fábrica.

COMO IDENTIFICAR O HODÔMETRO:
• É um número INTEIRO (sem casas decimais) — caminhão zero pode ter 5-1000 km, caminhão de uso geralmente 50.000-999.999 km
• Aparece no display digital central, painel LCD/VFD ou cluster de instrumentos
• Pode estar acompanhado dos labels "ODO", "KM TOTAL", "HODÔMETRO" ou sem label
• Formatos comuns: "303262" ou "303.262" ou "303 262" ou "303,262" (ou "5", "120", "8500" se for caminhão novo)
• Displays com iluminação colorida (azul, verde, laranja) são comuns — leia os dígitos independentemente da cor
• Em caminhões modernos (Volvo, Scania, Mercedes Atego/Actros) costuma ficar no display MID/FMI no centro do painel
• Em caminhões mais simples, pode estar num odômetro de rolo mecânico (números brancos em fundo preto)
• ATENÇÃO: o que diferencia hodômetro de "trip" é a AUSÊNCIA de casa decimal e o label "ODO"/"KM" (sem "Trip"/"Parcial")

O QUE NÃO É O HODÔMETRO (DESCARTE ESSES VALORES):
• Velocímetro analógico: mostrador redondo grande com agulha (escala 0-140, 0-160, 0-200 km/h) — ignore a escala numérica
• Velocidade atual digital: número ≤ 3 dígitos no display (ex: "0", "45", "80") — é km/h momentâneo
• Rotação RPM: números como "800", "1200", "2500" no tacômetro
• Hora/Relógio: formato "14:32" ou "8:05" (dois pontos no meio)
• Temperatura: números seguidos de "°" ou "°C"
• Pressão de ar/óleo: valores baixos (ex: "8.2", "5.5")
• Trip/Viagem (parcial): em muitos painéis modernos o trip TAMBÉM tem decimal — diferencie pelo CONTEXTO:
  - Trip é GERALMENTE menor que 10.000 km e fica ao lado de palavras como "trip", "parcial", "viagem"
  - Mas em painéis MERCEDES/VOLVO/SCANIA modernos, o hodômetro principal TAMBÉM pode aparecer com decimal e label "km" ao lado
  - Quando houver DOIS números com decimal: o que tem label "km" explícito é o hodômetro; o que vem isolado/embaixo geralmente é trip ou service interval

ATENÇÃO — ERROS COMUNS A EVITAR:
• NÃO leia a escala numérica do velocímetro analógico (40, 60, 80, 100, 120...) como hodômetro
• NÃO confunda o RPM com KM (RPM está no tacômetro, não no odômetro)
• Caminhões NOVOS/ZERO podem ter hodômetro com poucos dígitos (5 km, 120 km, 8500 km) — válido
• PRIORIDADE de identificação do hodômetro (do mais confiável ao menos):
  1. Número com label "km" ou "KM" ao lado (forte sinal)
  2. Número com label "ODO" ou "Total" ou "Hodômetro"
  3. Em painéis com múltiplos números: o que está acima/em destaque visual geralmente é o hodômetro
  4. Entre dois números com decimal, o que tem "km" ao lado vence (ex: "6357.2 km" > "0202883.3")
  5. Padding de zeros à esquerda (ex: "0202883") geralmente indica trip B ou service interval — NÃO é hodômetro principal
• Quando houver dúvida real entre 2 candidatos, marque confianca < 0.7 e liste AMBOS em candidatos_descartados

REGRAS DE CONFIANÇA:
• confianca = 1.0: dígitos claramente visíveis e o número está rotulado como ODO/KM TOTAL (ou é o único inteiro grande no display)
• confianca = 0.85: visível com leve dúvida (reflexo, ângulo ligeiramente oblíquo)
• confianca = 0.7: dúvida moderada (imagem desfocada mas dígitos identificáveis)
• confianca < 0.7: alta dúvida — marque leitura_segura=false e precisa_digitacao_manual=true
• Aceitar valores BAIXOS (< 10.000 km) sem reduzir confiança APENAS se houver label "ODO"/"KM" claro ou se for óbvio que é caminhão novo

Retorne km_lido como INTEGER (sem pontos, vírgulas, espaços ou casas decimais).`.trim();

// ------- API pública -------

export async function analyzeOdometerImage(file: File): Promise<OdometerReading> {
  // Pré-calcula hash uma vez pra usar tanto em cache quanto em resize
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = await hashBuffer(buffer);

  // Cache hit — retorna imediato (0ms)
  const cached = getCachedOcr(hash);
  if (cached) return cached;

  // Primary: OpenAI Vision (gpt-4o/gpt-4.1-mini/gpt-5-mini via Azure ou direto).
  const openai = getOpenAIClient();
  if (!openai) {
    return {
      ...FALLBACK_READING,
      motivo: "IA não configurada. Digite o KM manualmente.",
    };
  }

  try {
    // Redimensiona a imagem para acelerar a análise (passa o buffer já lido)
    const imageUrl = await resizeBufferForOcr(buffer, file.type);

    // Usa /chat/completions (compativel com qualquer api-version do Azure OpenAI).
    // Responses API (responses.parse) exige api-version 2025-03-01-preview+, nao da ainda.
    const response = await openai.chat.completions.create({
      model: getVisionModel(),
      temperature: 0.1, // OCR deve ser deterministico
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analise esta foto do painel do caminhão e extraia o hodômetro.

PASSO 1: Liste todos os números visíveis na imagem.
PASSO 2: Identifique qual é o hodômetro (maior número acumulado, geralmente >100.000 km).
PASSO 3: Descarte velocímetro, trip, RPM, hora. Liste como candidatos_descartados.
PASSO 4: Retorne km_lido como inteiro.

Se não conseguir identificar o hodômetro com clareza, retorne km_lido=null.

Retorne APENAS um JSON válido (sem texto extra) seguindo este schema:
{
  "km_lido": number | null,
  "confianca": number (0.0 a 1.0),
  "leitura_segura": boolean,
  "precisa_digitacao_manual": boolean,
  "motivo": string | null,
  "texto_visivel": string | null,
  "candidatos_descartados": [{"valor": number, "motivo": string}],
  "regiao_detectada": "hodometro_digital" | "hodometro_analogico" | "velocimetro" | "display_central" | "desconhecido"
}`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("[ai/odometer] resposta vazia");
      return FALLBACK_READING;
    }

    // Extrai o JSON (modelo as vezes adiciona texto ao redor)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[ai/odometer] JSON nao encontrado", content.slice(0, 200));
      return FALLBACK_READING;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.warn("[ai/odometer] JSON invalido", err);
      return FALLBACK_READING;
    }

    const result = OdometerReadingSchema.safeParse(parsedJson);
    if (!result.success) {
      console.warn("[ai/odometer] schema invalido", result.error.issues);
      return FALLBACK_READING;
    }
    const parsed = result.data;

    // Heurística: NÃO penaliza valores baixos (caminhão zero pode ter 5-1000 km).
    // Confia no que o modelo retornar — penaliza só se confiança ja vier baixa do modelo.
    // Caminhões novos sem KM cadastrado são caso valido e nao podem virar gargalo no OCR.
    const kmLido = parsed.km_lido;
    const confiancaFinal = parsed.confianca;

    const final: OdometerReading = {
      ...parsed,
      confianca: confiancaFinal,
      leitura_segura: parsed.leitura_segura && confiancaFinal >= 0.7 && kmLido != null,
      precisa_digitacao_manual: parsed.precisa_digitacao_manual || confiancaFinal < 0.7 || kmLido == null,
    };

    // Cacheia o resultado (5 min) — mesmo se for FALHOU, evita re-chamar IA pra mesma imagem ruim
    setCachedOcr(hash, final);
    return final;
  } catch (error) {
    // Log detalhado pra debug em prod (App Service logs)
    const err = error as { status?: number; message?: string; code?: string; name?: string };
    console.error("[ai/odometer] FALHA na chamada Azure OpenAI:", {
      name: err.name,
      message: err.message,
      status: err.status,
      code: err.code,
      model: getVisionModel(),
    });
    return FALLBACK_READING;
  }
}

// YOLO/Ollama removidos. OCR roda 100% via OpenAI Vision (Azure ou direto).
// As envs CHECKLIST_YOLO_ENDPOINT, CHECKLIST_ODOMETER_ENDPOINT, CHECKLIST_YOLO_TOKEN
// e OLLAMA_VISION_* ficam orfas no App Service (podem ser deletadas).
