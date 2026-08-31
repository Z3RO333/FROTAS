import "server-only";
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { AtividadeTipo } from "@/lib/atividades/rules";

export type AtividadeManutencao = {
  id: number;
  frota_id: number;
  frota_codigo: string;
  tipo: AtividadeTipo;
  local: string;
  observacao: string | null;
  motorista_ids: string[];
  motorista_nomes: string[];
  status: "PENDENTE" | "CONCLUIDA";
  foto_conclusao_path: string | null;
  criado_por_email: string;
  criado_por_nome: string;
  criado_em: string;
  concluido_em: string | null;
  concluido_por_id: string | null;
  concluido_por_nome: string | null;
};

const ATIVIDADE_COLUMNS =
  "id,frota_id,frota_codigo,tipo,local,observacao,motorista_ids,motorista_nomes,status,foto_conclusao_path,criado_por_email,criado_por_nome,criado_em,concluido_em,concluido_por_id,concluido_por_nome";

export type AtividadeFilters = {
  status?: "PENDENTE" | "CONCLUIDA";
  motoristaId?: string;
  limit?: number;
};

export async function listAtividades(filters: AtividadeFilters = {}): Promise<AtividadeManutencao[]> {
  let query = supabaseManutencao
    .from("atividades_manutencao")
    .select(ATIVIDADE_COLUMNS)
    .order("criado_em", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.motoristaId) query = query.contains("motorista_ids", [filters.motoristaId]);
  query = query.limit(filters.limit ?? 200);
  const { data, error } = await query;
  if (error) throw new Error(`listAtividades: ${error.message}`);
  return (data ?? []) as AtividadeManutencao[];
}

export async function listAtividadesPendentesPorMotorista(motoristaId: string): Promise<AtividadeManutencao[]> {
  const { data, error } = await supabaseManutencao
    .from("atividades_manutencao")
    .select(ATIVIDADE_COLUMNS)
    .contains("motorista_ids", [motoristaId])
    .eq("status", "PENDENTE")
    .order("criado_em", { ascending: true });
  if (error) throw new Error(`listAtividadesPendentesPorMotorista: ${error.message}`);
  return (data ?? []) as AtividadeManutencao[];
}

export async function listAtividadesRecentesPorMotorista(
  motoristaId: string,
  limit = 20
): Promise<AtividadeManutencao[]> {
  const { data, error } = await supabaseManutencao
    .from("atividades_manutencao")
    .select(ATIVIDADE_COLUMNS)
    .contains("motorista_ids", [motoristaId])
    .eq("status", "CONCLUIDA")
    .order("concluido_em", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listAtividadesRecentesPorMotorista: ${error.message}`);
  return (data ?? []) as AtividadeManutencao[];
}

export type CriarAtividadeInput = {
  frotaId: number;
  frotaCodigo: string;
  tipo: AtividadeTipo;
  local: string;
  observacao: string | null;
  motoristaIds: string[];
  motoristaNomes: string[];
  criadoPorEmail: string;
  criadoPorNome: string;
};

export async function criarAtividade(input: CriarAtividadeInput): Promise<AtividadeManutencao> {
  const { data, error } = await supabaseManutencao
    .from("atividades_manutencao")
    .insert({
      frota_id: input.frotaId,
      frota_codigo: input.frotaCodigo,
      tipo: input.tipo,
      local: input.local,
      observacao: input.observacao,
      motorista_ids: input.motoristaIds,
      motorista_nomes: input.motoristaNomes,
      criado_por_email: input.criadoPorEmail,
      criado_por_nome: input.criadoPorNome,
    })
    .select(ATIVIDADE_COLUMNS)
    .single();
  if (error) throw new Error(`criarAtividade: ${error.message}`);
  return data as AtividadeManutencao;
}

export async function concluirAtividade(
  id: number,
  input: { fotoPath: string | null; concluidoPorId: string; concluidoPorNome: string }
): Promise<void> {
  const { error } = await supabaseManutencao
    .from("atividades_manutencao")
    .update({
      status: "CONCLUIDA",
      concluido_em: new Date().toISOString(),
      concluido_por_id: input.concluidoPorId,
      concluido_por_nome: input.concluidoPorNome,
      foto_conclusao_path: input.fotoPath,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "PENDENTE");
  if (error) throw new Error(`concluirAtividade: ${error.message}`);
}
