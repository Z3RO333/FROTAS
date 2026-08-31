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
  status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA";
  foto_conclusao_paths: string[];
  criado_por_email: string;
  criado_por_nome: string;
  criado_em: string;
  concluido_em: string | null;
  concluido_por_id: string | null;
  concluido_por_nome: string | null;
  pego_em: string | null;
  iniciado_em: string | null;
};

const ATIVIDADE_COLUMNS =
  "id,frota_id,frota_codigo,tipo,local,observacao,motorista_ids,motorista_nomes,status,foto_conclusao_paths,criado_por_email,criado_por_nome,criado_em,concluido_em,concluido_por_id,concluido_por_nome,pego_em,iniciado_em";

/** Atividade sem motorista definido: qualquer motorista interno pode pegar. */
export function atividadeEstaAberta(atividade: AtividadeManutencao): boolean {
  return atividade.motorista_ids.length === 0;
}

export type AtividadeFilters = {
  status?: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA";
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

/** Atividades do motorista ainda por fazer — não iniciadas e em andamento. */
export async function listAtividadesPendentesPorMotorista(motoristaId: string): Promise<AtividadeManutencao[]> {
  const { data, error } = await supabaseManutencao
    .from("atividades_manutencao")
    .select(ATIVIDADE_COLUMNS)
    .contains("motorista_ids", [motoristaId])
    .in("status", ["PENDENTE", "EM_ANDAMENTO"])
    .order("criado_em", { ascending: true });
  if (error) throw new Error(`listAtividadesPendentesPorMotorista: ${error.message}`);
  return (data ?? []) as AtividadeManutencao[];
}

/** Atividades em aberto — sem motorista definido, disponíveis pra quem pegar. */
export async function listAtividadesAbertas(): Promise<AtividadeManutencao[]> {
  const { data, error } = await supabaseManutencao
    .from("atividades_manutencao")
    .select(ATIVIDADE_COLUMNS)
    .eq("status", "PENDENTE")
    .eq("motorista_ids", "{}")
    .order("criado_em", { ascending: true });
  if (error) throw new Error(`listAtividadesAbertas: ${error.message}`);
  return (data ?? []) as AtividadeManutencao[];
}

/**
 * Atribui uma atividade aberta a um motorista. Retorna false quando outro
 * motorista pegou primeiro — a corrida é resolvida no banco pela RPC.
 */
export async function pegarAtividade(
  id: number,
  motoristaId: string,
  motoristaNome: string
): Promise<boolean> {
  const { data, error } = await supabaseManutencao.rpc("pegar_atividade_manutencao", {
    p_atividade_id: id,
    p_motorista_id: motoristaId,
    p_motorista_nome: motoristaNome,
  });
  if (error) throw new Error(`pegarAtividade: ${error.message}`);
  return (data ?? []).length > 0;
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

/**
 * Marca a atividade como em andamento. Retorna false se ela já não estava mais
 * pendente — outro motorista designado pode ter iniciado antes.
 */
export async function iniciarAtividade(id: number, motoristaId: string): Promise<boolean> {
  const { data, error } = await supabaseManutencao
    .from("atividades_manutencao")
    .update({
      status: "EM_ANDAMENTO",
      iniciado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "PENDENTE")
    .contains("motorista_ids", [motoristaId])
    .select("id");
  if (error) throw new Error(`iniciarAtividade: ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * Conclui a atividade. Só vale para atividade em andamento: o motorista precisa
 * ter iniciado antes. Retorna false quando ela já não estava nesse estado
 * (outro motorista concluiu antes) — a corrida é resolvida pelo filtro de
 * status no banco, e o chamador precisa saber que não foi ele quem concluiu.
 */
export async function concluirAtividade(
  id: number,
  input: { fotoPaths: string[]; concluidoPorId: string; concluidoPorNome: string }
): Promise<boolean> {
  const { data, error } = await supabaseManutencao
    .from("atividades_manutencao")
    .update({
      status: "CONCLUIDA",
      concluido_em: new Date().toISOString(),
      concluido_por_id: input.concluidoPorId,
      concluido_por_nome: input.concluidoPorNome,
      foto_conclusao_paths: input.fotoPaths,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "EM_ANDAMENTO")
    .select("id");
  if (error) throw new Error(`concluirAtividade: ${error.message}`);
  return (data ?? []).length > 0;
}
