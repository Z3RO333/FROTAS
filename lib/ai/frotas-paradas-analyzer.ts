import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const ParadaAnalysisSchema = z.object({
  texto_corrigido: z.string().nullable(),
  criticidade: z.enum(["BAIXA", "MEDIA", "ALTA", "CRITICA"]),
  classificacao: z.string(),
  acao_recomendada: z.string(),
  justificativa: z.string(),
});

export type ParadaAnalysisResult = z.infer<typeof ParadaAnalysisSchema>;

const FALLBACK: ParadaAnalysisResult = {
  texto_corrigido: null,
  criticidade: "MEDIA",
  classificacao: "Manutenção corretiva",
  acao_recomendada: "Avaliar com técnico.",
  justificativa: "IA indisponível.",
};

const SYSTEM_PROMPT = `Você é um analista de frotas experiente. Analisa textos de problemas em veículos parados.

Criticidades:
- BAIXA: problema estético, limpeza, ajuste simples.
- MEDIA: problema mecânico não urgente, pode aguardar programação.
- ALTA: problema que afeta operação mas não há risco imediato de acidente.
- CRITICA: risco de acidente, falha grave de freio, direção, motor, vazamento de combustível.

Regras:
1. NUNCA invente problemas.
2. Preserve o sentido original ao corrigir o texto.
3. Se o texto já está correto, retorne texto_corrigido como null.
4. justificativa deve ser 1 frase curta.
5. classificacao deve ser categoria técnica (ex: "Suspensão", "Motor", "Freios", "Vazamento").
6. Responda APENAS com o JSON do schema.`;

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  _client ??= new OpenAI({ apiKey: key });
  return _client;
}

export async function analyzeParada(
  frota: string | null,
  descricao: string
): Promise<ParadaAnalysisResult> {
  const client = getClient();
  if (!client) return FALLBACK;

  const modelo = process.env.OPENAI_CHECKLIST_MODEL ?? "gpt-4.1-mini";

  try {
    const response = await client.responses.parse({
      model: modelo,
      input: [
        { role: "developer", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Frota: ${frota ?? "—"}\nProblema relatado: "${descricao}"\n\nClassifique e corrija se necessário.`,
        },
      ],
      text: { format: zodTextFormat(ParadaAnalysisSchema, "parada_analysis") },
    });

    return response.output_parsed ?? FALLBACK;
  } catch (err) {
    console.warn("[ai/paradas] falha ao analisar parada", err);
    return FALLBACK;
  }
}
