import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { reportCalendarDate, reportDayUtcRange, shiftCalendarDate } from "@/lib/report-date";

const SEVERITY_ORDER = ["OK", "ATENCAO", "CRITICO", "MANUTENCAO", "BLOQUEIO_SUGERIDO"];
function worstCriticidade(a: string, b: string): string {
  return SEVERITY_ORDER.indexOf(b) > SEVERITY_ORDER.indexOf(a) ? b : a;
}

export type RelatorioKpis = {
  total_checklists: number;
  ok: number;
  atencao: number;
  critico: number;
  manutencao: number;
  bloqueio_sugerido: number;
  pendentes_analise: number;
  alertas_abertos: number;
};

export type FrotaProblema = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  total_problemas: number;
  ultima_criticidade: string;
};

export type MotoristaRanking = {
  motorista_id: string;
  motorista_nome: string | null;
  total_checklists: number;
};

export type EvolucaoDiaria = {
  data: string;
  total: number;
  ok: number;
  atencao: number;
  critico: number;
};

export async function getRelatorioKpis(date: string): Promise<RelatorioKpis> {
  const { start, end } = reportDayUtcRange(date);

  const [analises, pendentes, alertas] = await Promise.all([
    supabaseManutencao
      .from("analises_checklist_ia")
      .select("criticidade")
      .gte("data_checklist", start)
      .lt("data_checklist", end),
    supabaseManutencao
      .from("checklists_frota")
      .select("id", { count: "exact", head: true })
      .eq("analise_status", "PENDENTE")
      .gte("data_checklist", start)
      .lt("data_checklist", end),
    supabaseManutencao
      .from("alertas_frota")
      .select("id", { count: "exact", head: true })
      .eq("status", "ABERTO"),
  ]);

  const rows = (analises.data ?? []) as Array<{ criticidade: string }>;
  const firstError = analises.error ?? pendentes.error ?? alertas.error;
  if (firstError) throw new Error(`getRelatorioKpis: ${firstError.message}`);

  return {
    total_checklists: rows.length,
    ok: rows.filter((r) => r.criticidade === "OK").length,
    atencao: rows.filter((r) => r.criticidade === "ATENCAO").length,
    critico: rows.filter((r) => r.criticidade === "CRITICO").length,
    manutencao: rows.filter((r) => r.criticidade === "MANUTENCAO").length,
    bloqueio_sugerido: rows.filter((r) => r.criticidade === "BLOQUEIO_SUGERIDO").length,
    pendentes_analise: pendentes.count ?? 0,
    alertas_abertos: alertas.count ?? 0,
  };
}

export async function getRankingFrotas(date: string, limit = 10): Promise<FrotaProblema[]> {
  const { start, end } = reportDayUtcRange(date);

  const { data, error } = await supabaseManutencao
    .from("analises_checklist_ia")
    .select("frota_id,criticidade,problemas_detectados")
    .gte("data_checklist", start)
    .lt("data_checklist", end)
    .in("criticidade", ["ATENCAO", "CRITICO", "MANUTENCAO", "BLOQUEIO_SUGERIDO"]);

  if (error) throw new Error(`getRankingFrotas: ${error.message}`);

  const frotaMap = new Map<number, { total: number; criticidade: string }>();
  for (const row of data ?? []) {
    const r = row as { frota_id: number; criticidade: string; problemas_detectados: unknown[] };
    const existing = frotaMap.get(r.frota_id) ?? { total: 0, criticidade: "OK" };
    frotaMap.set(r.frota_id, {
      total: existing.total + (Array.isArray(r.problemas_detectados) ? r.problemas_detectados.length : 0),
      criticidade: worstCriticidade(existing.criticidade, r.criticidade),
    });
  }

  const frotaIds = [...frotaMap.keys()];
  if (frotaIds.length === 0) return [];

  const { data: veiculos, error: veiculosError } = await supabaseManutencao
    .from("veiculos")
    .select("id,codigo_frota,placa")
    .in("id", frotaIds);
  if (veiculosError) throw new Error(`getRankingFrotas veiculos: ${veiculosError.message}`);

  const veiculoMap = new Map(
    (veiculos ?? []).map((v) => [Number(v.id), v as { id: number; codigo_frota: string | null; placa: string | null }])
  );

  return [...frotaMap.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([frota_id, info]) => ({
      frota_id,
      frota_geral: veiculoMap.get(frota_id)?.codigo_frota ?? null,
      placa: veiculoMap.get(frota_id)?.placa ?? null,
      total_problemas: info.total,
      ultima_criticidade: info.criticidade,
    }));
}

export async function getRankingMotoristas(date: string, limit = 10): Promise<MotoristaRanking[]> {
  const { start, end } = reportDayUtcRange(date);

  const { data, error } = await supabaseManutencao
    .from("checklists_frota")
    .select("motorista_id,motorista_nome")
    .gte("data_checklist", start)
    .lt("data_checklist", end);

  if (error) throw new Error(`getRankingMotoristas: ${error.message}`);

  const map = new Map<string, { nome: string | null; total: number }>();
  for (const row of (data ?? []) as Array<{ motorista_id: string; motorista_nome: string | null }>) {
    const existing = map.get(row.motorista_id) ?? { nome: row.motorista_nome, total: 0 };
    map.set(row.motorista_id, { ...existing, total: existing.total + 1 });
  }

  return [...map.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([motorista_id, info]) => ({
      motorista_id,
      motorista_nome: info.nome,
      total_checklists: info.total,
    }));
}

export async function getEvolucao7Dias(): Promise<EvolucaoDiaria[]> {
  const hoje = reportCalendarDate();

  const promises = Array.from({ length: 7 }, (_, i) => {
    const data = shiftCalendarDate(hoje, -(6 - i));
    return getRelatorioKpis(data).then((kpis) => ({
      data,
      total: kpis.total_checklists,
      ok: kpis.ok,
      atencao: kpis.atencao,
      critico: kpis.critico,
    }));
  });

  return Promise.all(promises);
}
