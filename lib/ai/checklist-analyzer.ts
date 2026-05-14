import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const ProblemaSchema = z.object({
  item: z.string(),
  severidade: z.enum(["LEVE", "MODERADA", "GRAVE"]),
  descricao: z.string(),
});

const ChecklistAnalysisSchema = z.object({
  texto_corrigido: z.string().nullable(),
  criticidade: z.enum(["OK", "ATENCAO", "CRITICO", "MANUTENCAO", "BLOQUEIO_SUGERIDO"]),
  resumo: z.string(),
  justificativa: z.string(),
  acao_recomendada: z.string().nullable(),
  manutencao_sugerida: z.boolean(),
  bloqueio_sugerido: z.boolean(),
  confianca: z.number().min(0).max(1),
  problemas_detectados: z.array(ProblemaSchema),
});

export type ChecklistAnalysisResult = z.infer<typeof ChecklistAnalysisSchema>;
export type ChecklistAnalysisInput = {
  checklist_id: number;
  frota_codigo: string | null;
  placa: string | null;
  modelo: string | null;
  km_informado: number | null;
  km_anterior: number | null;
  status_geral: string;
  observacao_original: string | null;
  itens: Array<{
    nome: string;
    grupo: string;
    status: string;
    critico: boolean;
    observacao: string | null;
  }>;
};

export type ChecklistAnalysisOutput = {
  result: ChecklistAnalysisResult | null;
  tokens_entrada: number;
  tokens_saida: number;
  duracao_ms: number;
  modelo: string;
  erro: string | null;
};

const FALLBACK: ChecklistAnalysisResult = {
  texto_corrigido: null,
  criticidade: "OK",
  resumo: "Análise indisponível.",
  justificativa: "IA não disponível no momento.",
  acao_recomendada: null,
  manutencao_sugerida: false,
  bloqueio_sugerido: false,
  confianca: 0,
  problemas_detectados: [],
};

let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  _client ??= new OpenAI({ apiKey: key });
  return _client;
}

const SYSTEM_PROMPT = `Você é um analista de frotas experiente. Analisa checklists de veículos e classifica riscos operacionais.

Classificações de criticidade:
- OK: Sem problemas relevantes. Todos os itens aptos, sem observações preocupantes.
- ATENCAO: Problema leve ou que precisa ser acompanhado (lâmpada queimada, arranhão pequeno, limpeza ruim).
- CRITICO: Problema que afeta segurança ou operação (freio com falha, pneu furado, vazamento de óleo, luz de alerta, superaquecimento).
- MANUTENCAO: Frota com indício claro de necessidade de manutenção preventiva ou corretiva.
- BLOQUEIO_SUGERIDO: Risco alto — veículo não deve circular (falha grave de freio, pneu rasgado, motor com problema grave).

Regras:
1. NUNCA invente problemas.
2. NUNCA remova informação importante do texto original.
3. Preserve o sentido original ao corrigir o texto.
4. A justificativa deve ser curta (1-2 frases).
5. Se não houver observação escrita, texto_corrigido deve ser null.
6. Responda APENAS com o JSON do schema.`;

export async function analyzeChecklist(
  input: ChecklistAnalysisInput
): Promise<ChecklistAnalysisOutput> {
  const client = getClient();
  const modelo = process.env.OPENAI_CHECKLIST_MODEL ?? "gpt-4.1-mini";
  const inicio = Date.now();

  if (!client) {
    return { result: FALLBACK, tokens_entrada: 0, tokens_saida: 0, duracao_ms: 0, modelo, erro: "OPENAI_API_KEY não configurada" };
  }

  const itensNaoAptos = input.itens.filter((i) => i.status === "NAO_APTO");
  const userContent = `
Frota: ${input.frota_codigo ?? "—"} | Placa: ${input.placa ?? "—"} | Modelo: ${input.modelo ?? "—"}
KM atual: ${input.km_informado ?? "—"} | KM anterior: ${input.km_anterior ?? "—"}
Status geral: ${input.status_geral}

Itens NÃO APTOS (${itensNaoAptos.length}):
${itensNaoAptos.map((i) => `- [${i.critico ? "CRÍTICO" : "normal"}] ${i.nome} (${i.grupo})${i.observacao ? `: "${i.observacao}"` : ""}`).join("\n") || "Nenhum"}

Observação geral do motorista:
"${input.observacao_original ?? ""}"

Analise e classifique.`.trim();

  try {
    const response = await client.responses.parse({
      model: modelo,
      input: [
        { role: "developer", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      text: { format: zodTextFormat(ChecklistAnalysisSchema, "checklist_analysis") },
    });

    const result = response.output_parsed;
    if (!result) {
      return { result: FALLBACK, tokens_entrada: 0, tokens_saida: 0, duracao_ms: Date.now() - inicio, modelo, erro: "Resposta vazia da IA" };
    }

    return {
      result,
      tokens_entrada: response.usage?.input_tokens ?? 0,
      tokens_saida: response.usage?.output_tokens ?? 0,
      duracao_ms: Date.now() - inicio,
      modelo,
      erro: null,
    };
  } catch (err) {
    return {
      result: FALLBACK,
      tokens_entrada: 0,
      tokens_saida: 0,
      duracao_ms: Date.now() - inicio,
      modelo,
      erro: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
