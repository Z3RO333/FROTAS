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
  motorista_id: string;
  motorista_nome: string;
  status: "PENDENTE" | "CONCLUIDA";
  foto_conclusao_path: string | null;
  criado_por_email: string;
  criado_por_nome: string;
  criado_em: string;
  concluido_em: string | null;
};

const ATIVIDADE_COLUMNS =
  "id,frota_id,frota_codigo,tipo,local,observacao,motorista_id,motorista_nome,status,foto_conclusao_path,criado_por_email,criado_por_nome,criado_em,concluido_em";

export type AtividadeFilters = {
  status?: "PENDENTE" | "CONCLUIDA";
  motoristaId?: string;
};

export async function listAtividades(filters: AtividadeFilters = {}): Promise<AtividadeManutencao[]> {
  let query = supabaseManutencao
    .from("atividades_manutencao")
    .select(ATIVIDADE_COLUMNS)
    .order("criado_em", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.motoristaId) query = query.eq("motorista_id", filters.motoristaId);
  const { data, error } = await query;
  if (error) throw new Error(`listAtividades: ${error.message}`);
  return (data ?? []) as AtividadeManutencao[];
}

export async function listAtividadesPendentesPorMotorista(motoristaId: string): Promise<AtividadeManutencao[]> {
  const { data, error } = await supabaseManutencao
    .from("atividades_manutencao")
    .select(ATIVIDADE_COLUMNS)
    .eq("motorista_id", motoristaId)
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
    .eq("motorista_id", motoristaId)
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
  motoristaId: string;
  motoristaNome: string;
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
      motorista_id: input.motoristaId,
      motorista_nome: input.motoristaNome,
      criado_por_email: input.criadoPorEmail,
      criado_por_nome: input.criadoPorNome,
    })
    .select(ATIVIDADE_COLUMNS)
    .single();
  if (error) throw new Error(`criarAtividade: ${error.message}`);
  return data as AtividadeManutencao;
}

export async function concluirAtividade(id: number, input: { fotoPath: string | null }): Promise<void> {
  const { error } = await supabaseManutencao
    .from("atividades_manutencao")
    .update({
      status: "CONCLUIDA",
      concluido_em: new Date().toISOString(),
      foto_conclusao_path: input.fotoPath,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "PENDENTE");
  if (error) throw new Error(`concluirAtividade: ${error.message}`);
}
