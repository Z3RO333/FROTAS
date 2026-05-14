import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { ChecklistAnalysisResult } from "@/lib/ai/checklist-analyzer";

export type AnaliseIaRow = {
  id: number;
  checklist_id: number;
  frota_id: number;
  motorista_id: string;
  data_checklist: string;
  texto_original: string | null;
  texto_corrigido: string | null;
  criticidade: "OK" | "ATENCAO" | "CRITICO" | "MANUTENCAO" | "BLOQUEIO_SUGERIDO";
  resumo_ia: string | null;
  justificativa: string | null;
  acao_recomendada: string | null;
  problemas_detectados: Array<{ item: string; severidade: string; descricao: string }>;
  manutencao_sugerida: boolean;
  bloqueio_sugerido: boolean;
  confianca: number | null;
  modelo_ia: string | null;
  analisado_em: string;
  revisado_por: string | null;
  revisado_em: string | null;
  criticidade_revisada: string | null;
};

export type SaveAnaliseInput = {
  checklist_id: number;
  frota_id: number;
  motorista_id: string;
  data_checklist: string;
  texto_original: string | null;
  result: ChecklistAnalysisResult;
  modelo_ia: string;
};

export async function saveAnaliseIa(input: SaveAnaliseInput): Promise<number> {
  const { data, error } = await supabaseManutencao
    .from("analises_checklist_ia")
    .upsert(
      {
        checklist_id: input.checklist_id,
        frota_id: input.frota_id,
        motorista_id: input.motorista_id,
        data_checklist: input.data_checklist,
        texto_original: input.texto_original,
        texto_corrigido: input.result.texto_corrigido,
        criticidade: input.result.criticidade,
        resumo_ia: input.result.resumo,
        justificativa: input.result.justificativa,
        acao_recomendada: input.result.acao_recomendada,
        problemas_detectados: input.result.problemas_detectados,
        manutencao_sugerida: input.result.manutencao_sugerida,
        bloqueio_sugerido: input.result.bloqueio_sugerido,
        confianca: input.result.confianca,
        modelo_ia: input.modelo_ia,
        analisado_em: new Date().toISOString(),
      },
      { onConflict: "checklist_id" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return Number(data.id);
}

export async function getAnaliseByChecklist(checklistId: number): Promise<AnaliseIaRow | null> {
  const { data, error } = await supabaseManutencao
    .from("analises_checklist_ia")
    .select("*")
    .eq("checklist_id", checklistId)
    .maybeSingle();
  if (error) throw error;
  return (data as AnaliseIaRow) ?? null;
}

export async function listAnalisesDia(date: string): Promise<AnaliseIaRow[]> {
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const { data, error } = await supabaseManutencao
    .from("analises_checklist_ia")
    .select("*")
    .gte("data_checklist", start)
    .lte("data_checklist", end)
    .order("analisado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AnaliseIaRow[];
}

export async function listChecklistsPendentesAnalise(limit = 50): Promise<
  Array<{ id: number; frota_id: number; motorista_id: string; data_checklist: string; observacao_original: string | null; km_informado: number | null }>
> {
  const { data, error } = await supabaseManutencao
    .from("checklists_frota")
    .select("id,frota_id,motorista_id,data_checklist,observacao_original,km_informado")
    .eq("analise_status", "PENDENTE")
    .order("criado_em", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function setAnaliseStatus(
  checklistId: number,
  status: "PENDENTE" | "PROCESSANDO" | "CONCLUIDA" | "ERRO"
): Promise<void> {
  const { error } = await supabaseManutencao
    .from("checklists_frota")
    .update({ analise_status: status })
    .eq("id", checklistId);
  if (error) throw error;
}

export async function saveLogIa(input: {
  operacao: string;
  checklist_id: number | null;
  frota_id: number | null;
  modelo: string;
  tokens_entrada: number;
  tokens_saida: number;
  duracao_ms: number;
  sucesso: boolean;
  erro_msg: string | null;
  payload_entrada: object;
  payload_saida: object | null;
}): Promise<void> {
  await supabaseManutencao.from("logs_ia").insert(input).then(({ error }) => {
    if (error) console.warn("[logs_ia] falha ao salvar log", error);
  });
}

export async function revisarAnalise(
  analiseId: number,
  revisadoPor: string,
  criticidadeRevisada: string
): Promise<void> {
  const { error } = await supabaseManutencao
    .from("analises_checklist_ia")
    .update({
      revisado_por: revisadoPor,
      revisado_em: new Date().toISOString(),
      criticidade_revisada: criticidadeRevisada,
    })
    .eq("id", analiseId);
  if (error) throw error;
}
