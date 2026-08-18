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
