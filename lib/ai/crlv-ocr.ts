import { z } from "zod";
import { getVisionClient, getVisionModel } from "@/lib/ai/vision-client";
import { renderFirstPageToPng } from "@/lib/ai/pdf-render";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const CrlvReadingSchema = z.object({
  data_vencimento: z.string().regex(DATE_RE).nullable(),
  data_emissao: z.string().regex(DATE_RE).nullable(),
  confianca: z.number().min(0).max(1),
  leitura_segura: z.boolean(),
  motivo: z.string().nullable(),
});

export type CrlvReading = z.infer<typeof CrlvReadingSchema>;

const FALLBACK_READING: CrlvReading = {
  data_vencimento: null,
  data_emissao: null,
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

TAREFA: Extrair duas datas do documento — NÃO faça nenhuma conta de calendário, apenas leia o que está escrito.

1. data_vencimento: a DATA DE VENCIMENTO/VALIDADE do licenciamento, só se aparecer explicitamente rotulada como "Válido até", "Data Máxima de Licenciamento" ou "Vencimento". O campo "Exercício" NÃO é vencimento — é só o ano de referência do licenciamento; se só existir "Exercício", retorne data_vencimento=null.
2. data_emissao: a data de emissão/assinatura do documento pelo DETRAN, geralmente no rodapé ("Documento emitido por DETRAN ... em DD/MM/AAAA"). Retorne null se não encontrar.

REGRAS:
• Ignore data de nascimento do proprietário ou de outros documentos na mesma página.
• Retorne as datas no formato YYYY-MM-DD.
• Se não conseguir identificar nenhuma das duas datas com segurança, retorne null nos dois campos e leitura_segura=false.

REGRAS DE CONFIANÇA (o sistema descarta qualquer leitura com confianca < 0.7, mesmo que leitura_segura=true — nunca retorne confianca abaixo de 0.7 quando leitura_segura=true):
• confianca >= 0.9: data(s) claramente rotulada(s) e legível(is).
• confianca 0.7-0.89: legível mas com alguma dúvida (leve borrão, ângulo).
• confianca < 0.7: dúvida real — marque leitura_segura=false.

Retorne APENAS um JSON válido (sem texto extra) seguindo este schema:
{
  "data_vencimento": "YYYY-MM-DD" | null,
  "data_emissao": "YYYY-MM-DD" | null,
  "confianca": number (0.0 a 1.0),
  "leitura_segura": boolean,
  "motivo": string | null
}`.trim();

// Último dia do mês de emissão, um ano depois — o licenciamento cobre o mês
// inteiro (CONTRAN), então um CRLV emitido em qualquer dia de setembro/2025
// só vence de fato em 01/10/2026, não no mesmo dia de setembro. Cálculo em
// UTC pra não depender do fuso do servidor.
export function estimarVencimentoPorEmissao(dataEmissaoISO: string): string {
  const [anoStr, mesStr] = dataEmissaoISO.split("-");
  const anoVencimento = Number(anoStr) + 1;
  const mes = Number(mesStr);
  const ultimoDia = new Date(Date.UTC(anoVencimento, mes, 0));
  const yyyy = ultimoDia.getUTCFullYear();
  const mm = String(ultimoDia.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ultimoDia.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function comEstimativaPorEmissao(reading: CrlvReading): CrlvReading {
  if (reading.data_vencimento || !reading.data_emissao) return reading;
  const dataVencimentoEstimada = estimarVencimentoPorEmissao(reading.data_emissao);
  return {
    ...reading,
    data_vencimento: dataVencimentoEstimada,
    leitura_segura: true,
    confianca: Math.max(reading.confianca, 0.75),
    motivo: `Sem campo de vencimento explícito — estimado a partir da emissão (${reading.data_emissao}): fim do mês de licenciamento no ano seguinte.`,
  };
}

export async function readCrlvVencimento(pdfBuffer: Buffer): Promise<CrlvReading> {
  const client = getVisionClient();
  if (!client) {
    return { ...FALLBACK_READING, motivo: "IA não configurada. Confira o vencimento manualmente." };
  }

  try {
    const png = await renderFirstPageToPng(pdfBuffer);
    const imageUrl = `data:image/png;base64,${png.toString("base64")}`;
    const model = getVisionModel();

    const response = await client.chat.completions.create({
      model,
      // Modelos da família gpt-5 só aceitam o temperature padrão (1) — mandar
      // 0.1 derruba a chamada com 400 unsupported_value.
      ...(model.startsWith("gpt-5") ? {} : { temperature: 0.1 }),
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

    return applyConfidenceThreshold(comEstimativaPorEmissao(result.data));
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
