import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type MotoristaStats = {
  motorista_id: string;
  motorista_nome: string | null;
  total_movimentacoes: number;
  frotas_distintas: number;
  ultima_movimentacao: string | null;
  total_saidas: number;
};

export type MotoristaFrotaHistorico = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  qtd_movimentacoes: number;
  ultima_vez: string | null;
};

export type MotoristaChecklistStats = {
  total_checklists: number;
  km_total: number;
  ultimo_checklist: string | null;
  frotas_distintas: number;
};

export async function listMotoristasStats(): Promise<MotoristaStats[]> {
  const { data, error } = await supabaseManutencao
    .from("v_motorista_stats")
    .select("*")
    .order("total_movimentacoes", { ascending: false });
  if (error) {
    console.warn("[motoristas] falha ao listar stats", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    motorista_id: String(r.motorista_id),
    motorista_nome: r.motorista_nome ?? null,
    total_movimentacoes: Number(r.total_movimentacoes ?? 0),
    frotas_distintas: Number(r.frotas_distintas ?? 0),
    ultima_movimentacao: r.ultima_movimentacao ?? null,
    total_saidas: Number(r.total_saidas ?? 0),
  }));
}

export async function getFrotasDoMotorista(motoristaId: string): Promise<MotoristaFrotaHistorico[]> {
  const { data, error } = await supabaseManutencao
    .from("v_motorista_frotas")
    .select("*")
    .eq("motorista_id", motoristaId)
    .order("qtd_movimentacoes", { ascending: false });
  if (error) {
    console.warn("[motoristas] falha ao buscar frotas", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    frota_id: Number(r.frota_id),
    frota_geral: r.frota_geral ?? null,
    placa: r.placa ?? null,
    qtd_movimentacoes: Number(r.qtd_movimentacoes ?? 0),
    ultima_vez: r.ultima_vez ?? null,
  }));
}

export async function getChecklistStatsMotorista(motoristaId: string): Promise<MotoristaChecklistStats> {
  const { data, error } = await supabaseManutencao
    .from("checklists_frota")
    .select("id, km_informado, criado_em, frota_id")
    .eq("motorista_id", motoristaId);

  if (error || !data) {
    return { total_checklists: 0, km_total: 0, ultimo_checklist: null, frotas_distintas: 0 };
  }

  const km_total = data.reduce((s, c) => s + Number(c.km_informado ?? 0), 0);
  const sorted = [...data].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  const frotas = new Set(data.map((c) => c.frota_id)).size;

  return {
    total_checklists: data.length,
    km_total,
    ultimo_checklist: sorted[0]?.criado_em ?? null,
    frotas_distintas: frotas,
  };
}
