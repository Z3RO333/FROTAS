import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { reportCalendarDate, reportDayUtcRange, shiftCalendarDate } from "@/lib/report-date";
import { listFrotasForReport } from "@/lib/repos/frotas";

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

export type FrotaResumoChecklist = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
};

function frotaSortKey(f: { frota_geral: string | null; placa: string | null; frota_id: number }): [string, string] {
  const key = f.frota_geral ?? f.placa ?? String(f.frota_id);
  const numKey = Number(key);
  const isNumeric = !isNaN(numKey) && key.trim() !== "";
  return [isNumeric ? "0" : "1", key];
}

function compareFrotaKeys(a: [string, string], b: [string, string]): number {
  if (a[0] !== b[0]) {
    return a[0].localeCompare(b[0]);
  }
  const numA = Number(a[1]);
  const numB = Number(b[1]);
  if (!isNaN(numA) && !isNaN(numB)) {
    return numA - numB;
  }
  return a[1].localeCompare(b[1]);
}

export function splitFrotasPorChecklist(
  frotasAtivas: { id: number; frota_geral: string | null; placa: string | null }[],
  frotaIdsComChecklist: number[]
): { fizeram: FrotaResumoChecklist[]; naoFizeram: FrotaResumoChecklist[] } {
  const comChecklist = new Set(frotaIdsComChecklist);
  const fizeram: FrotaResumoChecklist[] = [];
  const naoFizeram: FrotaResumoChecklist[] = [];

  for (const frota of frotasAtivas) {
    const resumo: FrotaResumoChecklist = {
      frota_id: frota.id,
      frota_geral: frota.frota_geral,
      placa: frota.placa,
    };
    if (comChecklist.has(frota.id)) fizeram.push(resumo);
    else naoFizeram.push(resumo);
  }

  const bySortKey = (a: FrotaResumoChecklist, b: FrotaResumoChecklist) =>
    compareFrotaKeys(frotaSortKey(a), frotaSortKey(b));

  return { fizeram: fizeram.sort(bySortKey), naoFizeram: naoFizeram.sort(bySortKey) };
}

export type PendenciaComFrota = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  item_nome: string;
  gravidade: string;
};

export type PendenciaGrupoFrota = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  itens: { item_nome: string; gravidade: string }[];
};

export function agruparPendenciasPorFrota(pendencias: PendenciaComFrota[]): PendenciaGrupoFrota[] {
  const map = new Map<number, PendenciaGrupoFrota>();

  for (const p of pendencias) {
    const existing = map.get(p.frota_id);
    if (existing) {
      existing.itens.push({ item_nome: p.item_nome, gravidade: p.gravidade });
    } else {
      map.set(p.frota_id, {
        frota_id: p.frota_id,
        frota_geral: p.frota_geral,
        placa: p.placa,
        itens: [{ item_nome: p.item_nome, gravidade: p.gravidade }],
      });
    }
  }

  return [...map.values()].sort((a, b) => compareFrotaKeys(frotaSortKey(a), frotaSortKey(b)));
}

export type ObservacaoComFrota = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  motorista_nome: string | null;
  observacao: string;
};

export type ObservacaoGrupoFrota = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  observacoes: { motorista_nome: string | null; observacao: string }[];
};

export function agruparObservacoesPorFrota(observacoes: ObservacaoComFrota[]): ObservacaoGrupoFrota[] {
  const map = new Map<number, ObservacaoGrupoFrota>();

  for (const o of observacoes) {
    const existing = map.get(o.frota_id);
    if (existing) {
      existing.observacoes.push({ motorista_nome: o.motorista_nome, observacao: o.observacao });
    } else {
      map.set(o.frota_id, {
        frota_id: o.frota_id,
        frota_geral: o.frota_geral,
        placa: o.placa,
        observacoes: [{ motorista_nome: o.motorista_nome, observacao: o.observacao }],
      });
    }
  }

  return [...map.values()].sort((a, b) => compareFrotaKeys(frotaSortKey(a), frotaSortKey(b)));
}

export function extrairObservacoesValidas(
  rows: {
    frota_id: number;
    motorista_nome: string | null;
    observacao_original: string | null;
    observacao_corrigida_ia: string | null;
  }[]
): { frota_id: number; motorista_nome: string | null; observacao: string }[] {
  return rows
    .map((r) => ({
      frota_id: r.frota_id,
      motorista_nome: r.motorista_nome,
      observacao: r.observacao_corrigida_ia?.trim() || r.observacao_original?.trim() || "",
    }))
    .filter((r) => r.observacao.length > 0);
}

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

export async function getChecklistsRealizadosNoDia(date: string): Promise<number> {
  const { start, end } = reportDayUtcRange(date);

  const { count, error } = await supabaseManutencao
    .from("checklists_frota")
    .select("id", { count: "exact", head: true })
    .gte("data_checklist", start)
    .lt("data_checklist", end);

  if (error) throw new Error(`getChecklistsRealizadosNoDia: ${error.message}`);
  return count ?? 0;
}

export async function getFrotasComSemChecklistNoDia(
  date: string
): Promise<{ fizeram: FrotaResumoChecklist[]; naoFizeram: FrotaResumoChecklist[] }> {
  const { start, end } = reportDayUtcRange(date);

  async function fetchAllChecklistFrotaIds(): Promise<number[]> {
    const rows: { frota_id: number }[] = [];
    const chunkSize = 1000;
    for (let from = 0; ; from += chunkSize) {
      const { data, error } = await supabaseManutencao
        .from("checklists_frota")
        .select("frota_id")
        .gte("data_checklist", start)
        .lt("data_checklist", end)
        .order("id", { ascending: true })
        .range(from, from + chunkSize - 1);
      if (error) throw new Error(`getFrotasComSemChecklistNoDia: ${error.message}`);
      const chunk = (data ?? []) as { frota_id: number }[];
      rows.push(...chunk);
      if (chunk.length < chunkSize) break;
    }
    return rows.map((r) => Number(r.frota_id));
  }

  const [frotasAtivas, frotaIdsComChecklist] = await Promise.all([
    listFrotasForReport(),
    fetchAllChecklistFrotaIds(),
  ]);

  return splitFrotasPorChecklist(
    frotasAtivas.map((f) => ({ id: f.id, frota_geral: f.frota_geral, placa: f.placa })),
    frotaIdsComChecklist
  );
}

export async function getPendenciasCriadasNoDiaPorFrota(date: string): Promise<PendenciaGrupoFrota[]> {
  const { start, end } = reportDayUtcRange(date);

  const rows: { frota_id: number; item_nome: string; gravidade: string }[] = [];
  const chunkSize = 1000;
  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await supabaseManutencao
      .from("pendencias_frota")
      .select("frota_id,item_nome,gravidade")
      .gte("criado_em", start)
      .lt("criado_em", end)
      .order("id", { ascending: true })
      .range(from, from + chunkSize - 1);
    if (error) throw new Error(`getPendenciasCriadasNoDiaPorFrota: ${error.message}`);
    const chunk = (data ?? []) as { frota_id: number; item_nome: string; gravidade: string }[];
    rows.push(...chunk);
    if (chunk.length < chunkSize) break;
  }

  const frotaIds = [...new Set(rows.map((r) => r.frota_id))];
  if (frotaIds.length === 0) return [];

  const { data: veiculos, error: veiculosError } = await supabaseManutencao
    .from("veiculos")
    .select("id,codigo_frota,placa")
    .in("id", frotaIds);
  if (veiculosError) throw new Error(`getPendenciasCriadasNoDiaPorFrota veiculos: ${veiculosError.message}`);

  const veiculoMap = new Map(
    (veiculos ?? []).map((v) => [Number(v.id), v as { id: number; codigo_frota: string | null; placa: string | null }])
  );

  const pendenciasComFrota: PendenciaComFrota[] = rows.map((r) => ({
    frota_id: r.frota_id,
    frota_geral: veiculoMap.get(r.frota_id)?.codigo_frota ?? null,
    placa: veiculoMap.get(r.frota_id)?.placa ?? null,
    item_nome: r.item_nome,
    gravidade: r.gravidade,
  }));

  return agruparPendenciasPorFrota(pendenciasComFrota);
}

export async function getObservacoesCriadasNoDiaPorFrota(date: string): Promise<ObservacaoGrupoFrota[]> {
  const { start, end } = reportDayUtcRange(date);

  const rows: {
    frota_id: number;
    motorista_nome: string | null;
    observacao_original: string | null;
    observacao_corrigida_ia: string | null;
  }[] = [];
  const chunkSize = 1000;
  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await supabaseManutencao
      .from("checklists_frota")
      .select("frota_id,motorista_nome,observacao_original,observacao_corrigida_ia")
      .gte("data_checklist", start)
      .lt("data_checklist", end)
      .order("id", { ascending: true })
      .range(from, from + chunkSize - 1);
    if (error) throw new Error(`getObservacoesCriadasNoDiaPorFrota: ${error.message}`);
    const chunk = (data ?? []) as typeof rows;
    rows.push(...chunk);
    if (chunk.length < chunkSize) break;
  }

  const comObservacao = extrairObservacoesValidas(rows);

  const frotaIds = [...new Set(comObservacao.map((r) => r.frota_id))];
  if (frotaIds.length === 0) return [];

  const { data: veiculos, error: veiculosError } = await supabaseManutencao
    .from("veiculos")
    .select("id,codigo_frota,placa")
    .in("id", frotaIds);
  if (veiculosError) throw new Error(`getObservacoesCriadasNoDiaPorFrota veiculos: ${veiculosError.message}`);

  const veiculoMap = new Map(
    (veiculos ?? []).map((v) => [Number(v.id), v as { id: number; codigo_frota: string | null; placa: string | null }])
  );

  const observacoesComFrota: ObservacaoComFrota[] = comObservacao.map((r) => ({
    frota_id: r.frota_id,
    frota_geral: veiculoMap.get(r.frota_id)?.codigo_frota ?? null,
    placa: veiculoMap.get(r.frota_id)?.placa ?? null,
    motorista_nome: r.motorista_nome,
    observacao: r.observacao,
  }));

  return agruparObservacoesPorFrota(observacoesComFrota);
}
