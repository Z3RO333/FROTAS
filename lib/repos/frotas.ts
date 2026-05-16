import { randomUUID } from "node:crypto";
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { StatusFrota } from "@/lib/rules";
import { appendHistorico } from "@/lib/repos/historico";

export type Frota = {
  id: number;
  frota_geral: string | null;
  placa: string | null;
  modelo: string | null;
  chassi: string | null;
  renavam: string | null;
  ano_fabricacao: number | null;
  localizacao: string | null;
  km_atual: number | null;
  status: StatusFrota | null;
  observacoes: string | null;
  vendido: boolean;
  ano_venda: number | null;
  ativo: boolean;
  criado_em: string | null;
  atualizado_em: string | null;
  atualizado_por: string | null;
  km_origem: string | null;
  km_atualizado_em: string | null;
  km_validado: boolean | null;
  ultimo_checklist_id: number | null;
  ultimo_checklist_em: string | null;
  ultimo_motorista_id: string | null;
  ultimo_motorista_nome: string | null;
  ultimo_abastecimento_em: string | null;
  ultimo_abastecimento_litros: number | null;
  status_operacional: string | null;
  manutencao_motivo: string | null;
  manutencao_tipo: string | null;
  manutencao_oficina: string | null;
  manutencao_prev_retorno: string | null;
  manutencao_observacao: string | null;
  manutencao_iniciado_em: string | null;
  manutencao_iniciado_por: string | null;
  manutencao_bloqueia_checklist: boolean | null;
  combustivel_atual_nivel: number | null;
  combustivel_atualizado_em: string | null;
  combustivel_origem: string | null;
  arla_atual_nivel: number | null;
  arla_atualizado_em: string | null;
  arla_origem: string | null;
};

type VeiculoRow = {
  id: number;
  codigo_frota: string | null;
  placa: string | null;
  modelo: string | null;
  chassi: string | null;
  renavam: string | null;
  ano_fabricacao: number | null;
  local: string | null;
  km_atual: number | null;
  status: StatusFrota | null;
  observacoes: string | null;
  vendido: boolean | null;
  ano_venda: number | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  atualizado_por: string | null;
  km_origem: string | null;
  km_atualizado_em: string | null;
  km_validado: boolean | null;
  ultimo_checklist_id: number | null;
  ultimo_checklist_em: string | null;
  ultimo_motorista_id: string | null;
  ultimo_motorista_nome: string | null;
  ultimo_abastecimento_em: string | null;
  ultimo_abastecimento_litros: number | null;
  status_operacional: string | null;
  manutencao_motivo: string | null;
  manutencao_tipo: string | null;
  manutencao_oficina: string | null;
  manutencao_prev_retorno: string | null;
  manutencao_observacao: string | null;
  manutencao_iniciado_em: string | null;
  manutencao_iniciado_por: string | null;
  manutencao_bloqueia_checklist: boolean | null;
};

export type FrotaFilters = {
  search?: string;
  modelo?: string;
  localizacao?: string;
  ano?: number;
  status?: StatusFrota;
  operacional?: "disponivel" | "manutencao" | "indisponivel" | "baixado";
  condicao?: "normal" | "atencao" | "critico";
  cadastro?: "incompleto";
  semKm?: boolean;
  idadeMin?: number;
  vendidos?: boolean;
  page?: number;
  pageSize?: number;
};

export type Kpis = {
  total_ativos: number;
  total_disponiveis: number;
  total_indisponiveis: number;
  total_atencao: number;
  total_critico: number;
  total_manutencao: number;
  total_manutencao_atrasada: number;
  total_manutencao_longa: number;
  total_sem_km: number;
  total_acima_7: number;
  total_cadastro_incompleto: number;
  idade_media: number | null;
  km_medio: number | null;
  preventiva_atrasada: number;
  alinhamento_atrasado: number;
  arcondicionado_atrasado: number;
  tacografo_atrasado: number;
  lavagem_atrasada: number;
  disponibilidade_pct: number;
};

export type FrotaInput = {
  frota_geral?: string | null;
  placa?: string | null;
  modelo?: string | null;
  chassi?: string | null;
  renavam?: string | null;
  ano_fabricacao?: number | null;
  localizacao?: string | null;
  km_atual?: number | null;
  status?: StatusFrota | null;
  observacoes?: string | null;
};

const TRACKED_FIELDS = ["chassi", "km_atual", "status", "observacoes", "localizacao"] as const;
const WRITABLE_FIELDS = [
  "frota_geral",
  "placa",
  "modelo",
  "chassi",
  "renavam",
  "ano_fabricacao",
  "localizacao",
  "km_atual",
  "status",
  "observacoes",
] as const satisfies readonly (keyof FrotaInput)[];

function fromVeiculo(row: VeiculoRow): Frota {
  return {
    id: Number(row.id),
    frota_geral: row.codigo_frota,
    placa: row.placa,
    modelo: row.modelo,
    chassi: row.chassi,
    renavam: row.renavam,
    ano_fabricacao: row.ano_fabricacao != null ? Number(row.ano_fabricacao) : null,
    localizacao: row.local,
    km_atual: row.km_atual != null ? Number(row.km_atual) : null,
    status: row.status,
    observacoes: row.observacoes,
    vendido: Boolean(row.vendido),
    ano_venda: row.ano_venda != null ? Number(row.ano_venda) : null,
    ativo: row.ativo !== false,
    criado_em: row.created_at,
    atualizado_em: row.updated_at,
    atualizado_por: row.atualizado_por,
    km_origem: row.km_origem,
    km_atualizado_em: row.km_atualizado_em,
    km_validado: row.km_validado,
    ultimo_checklist_id: row.ultimo_checklist_id != null ? Number(row.ultimo_checklist_id) : null,
    ultimo_checklist_em: row.ultimo_checklist_em,
    ultimo_motorista_id: row.ultimo_motorista_id,
    ultimo_motorista_nome: row.ultimo_motorista_nome,
    ultimo_abastecimento_em: row.ultimo_abastecimento_em,
    ultimo_abastecimento_litros:
      row.ultimo_abastecimento_litros != null ? Number(row.ultimo_abastecimento_litros) : null,
    status_operacional: row.status_operacional,
    manutencao_motivo: (row as VeiculoRow & { manutencao_motivo?: string | null }).manutencao_motivo ?? null,
    manutencao_tipo: (row as VeiculoRow & { manutencao_tipo?: string | null }).manutencao_tipo ?? null,
    manutencao_oficina: (row as VeiculoRow & { manutencao_oficina?: string | null }).manutencao_oficina ?? null,
    manutencao_prev_retorno:
      (row as VeiculoRow & { manutencao_prev_retorno?: string | null }).manutencao_prev_retorno ?? null,
    manutencao_observacao:
      (row as VeiculoRow & { manutencao_observacao?: string | null }).manutencao_observacao ?? null,
    manutencao_iniciado_em:
      (row as VeiculoRow & { manutencao_iniciado_em?: string | null }).manutencao_iniciado_em ?? null,
    manutencao_iniciado_por:
      (row as VeiculoRow & { manutencao_iniciado_por?: string | null }).manutencao_iniciado_por ?? null,
    manutencao_bloqueia_checklist:
      (row as VeiculoRow & { manutencao_bloqueia_checklist?: boolean | null })
        .manutencao_bloqueia_checklist ?? null,
    combustivel_atual_nivel:
      (row as VeiculoRow & { combustivel_atual_nivel?: number | null }).combustivel_atual_nivel ??
      null,
    combustivel_atualizado_em:
      (row as VeiculoRow & { combustivel_atualizado_em?: string | null })
        .combustivel_atualizado_em ?? null,
    combustivel_origem:
      (row as VeiculoRow & { combustivel_origem?: string | null }).combustivel_origem ?? null,
    arla_atual_nivel:
      (row as VeiculoRow & { arla_atual_nivel?: number | null }).arla_atual_nivel ?? null,
    arla_atualizado_em:
      (row as VeiculoRow & { arla_atualizado_em?: string | null }).arla_atualizado_em ?? null,
    arla_origem: (row as VeiculoRow & { arla_origem?: string | null }).arla_origem ?? null,
  };
}

function toVeiculoInput(input: Partial<FrotaInput>, userEmail?: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.frota_geral !== undefined) out.codigo_frota = input.frota_geral;
  if (input.placa !== undefined) out.placa = input.placa;
  if (input.modelo !== undefined) out.modelo = input.modelo;
  if (input.chassi !== undefined) out.chassi = input.chassi;
  if (input.renavam !== undefined) out.renavam = input.renavam;
  if (input.ano_fabricacao !== undefined) out.ano_fabricacao = input.ano_fabricacao;
  if (input.localizacao !== undefined) out.local = input.localizacao;
  if (input.km_atual !== undefined) out.km_atual = input.km_atual;
  if (input.status !== undefined) out.status = input.status;
  if (input.observacoes !== undefined) out.observacoes = input.observacoes;
  if (userEmail) out.atualizado_por = userEmail;
  return out;
}

function pagination(f: FrotaFilters): { page: number; pageSize: number } {
  return {
    page: Math.max(1, Math.floor(f.page ?? 1)),
    pageSize: Math.max(1, Math.min(200, Math.floor(f.pageSize ?? 50))),
  };
}

function idade(frota: Frota): number | null {
  if (!frota.ano_fabricacao) return null;
  return new Date().getFullYear() - frota.ano_fabricacao;
}

function cadastroIncompleto(frota: Frota): boolean {
  return !frota.placa?.trim() || !frota.chassi?.trim() || frota.km_atual == null;
}

function condition(frota: Frota): "normal" | "atencao" | "critico" {
  const age = idade(frota);
  if (frota.status === "critico" || (age != null && age >= 10)) return "critico";
  if (
    frota.status === "atencao" ||
    frota.status === "manutencao" ||
    (age != null && age >= 7) ||
    cadastroIncompleto(frota)
  ) {
    return "atencao";
  }
  return "normal";
}

function operacional(frota: Frota): "disponivel" | "manutencao" | "indisponivel" | "baixado" {
  if (frota.vendido || frota.status === "vendido") return "baixado";
  if (frota.status === "manutencao") return "manutencao";
  if (frota.status === "critico") return "indisponivel";
  return "disponivel";
}

function matchesFilters(frota: Frota, f: FrotaFilters): boolean {
  if (f.vendidos || f.operacional === "baixado") {
    if (!frota.vendido && frota.status !== "vendido") return false;
  } else if (frota.vendido) {
    return false;
  }
  if (f.search) {
    const haystack = [
      frota.frota_geral,
      frota.placa,
      frota.chassi,
      frota.modelo,
      frota.localizacao,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(f.search.toLowerCase())) return false;
  }
  if (f.modelo && frota.modelo !== f.modelo) return false;
  if (f.localizacao && frota.localizacao !== f.localizacao) return false;
  if (f.ano && frota.ano_fabricacao !== f.ano) return false;
  if (f.status && frota.status !== f.status) return false;
  if (f.operacional && operacional(frota) !== f.operacional) return false;
  if (f.condicao && condition(frota) !== f.condicao) return false;
  if (f.cadastro === "incompleto" && !cadastroIncompleto(frota)) return false;
  if (f.semKm && frota.km_atual != null) return false;
  if (f.idadeMin && (idade(frota) ?? -1) < f.idadeMin) return false;
  return frota.ativo;
}

// Cache de analytics (30s) para evitar re-fetch em múltiplas calls por página
const _analyticsCache = new Map<string, { val: unknown; exp: number }>();
function analyticsCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = _analyticsCache.get(key);
  if (hit && Date.now() < hit.exp) return Promise.resolve(hit.val as T);
  return fn().then((val) => {
    _analyticsCache.set(key, { val, exp: Date.now() + ttlMs });
    return val;
  });
}

// Colunas mínimas para cálculos derivados (condition/operacional/cadastroIncompleto)
const COLS_MINIMAL =
  "id,codigo_frota,placa,modelo,chassi,renavam,local,ano_fabricacao,km_atual,status,vendido,ativo,status_operacional,manutencao_prev_retorno,manutencao_iniciado_em,manutencao_bloqueia_checklist";

// Colunas para listagem (inclui campos exibidos na tabela, exclui combustivel/arla/km_meta)
const COLS_LIST =
  "id,codigo_frota,placa,modelo,chassi,renavam,local,ano_fabricacao,km_atual,status,status_operacional,vendido,ativo,updated_at,atualizado_por,manutencao_motivo,manutencao_tipo,manutencao_oficina,manutencao_bloqueia_checklist,manutencao_prev_retorno,manutencao_iniciado_em,manutencao_iniciado_por";

// Mantida para compatibilidade com kpis() e funções de analytics internas
async function allFrotas(): Promise<Frota[]> {
  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select(COLS_MINIMAL) // antes era SELECT * com 30+ colunas desnecessárias
    .eq("ativo", true)
    .eq("vendido", false)
    .order("id", { ascending: true })
    .limit(5000);
  if (error) throw new Error(`allFrotas: ${error.message}`);
  return ((data ?? []) as VeiculoRow[]).map(fromVeiculo);
}

export async function listFrotas(f: FrotaFilters = {}): Promise<{ rows: Frota[]; total: number }> {
  const { page, pageSize } = pagination(f);

  // Monta query com filtros SQL — COLS_LIST exclui combustivel/arla/observacoes (~10 colunas pesadas)
  let q = supabaseManutencao.from("veiculos").select(COLS_LIST);

  if (f.vendidos || f.operacional === "baixado") {
    q = q.eq("vendido", true);
  } else {
    q = q.eq("vendido", false).eq("ativo", true);
  }

  if (f.modelo) q = q.eq("modelo", f.modelo);
  if (f.localizacao) q = q.eq("local", f.localizacao);
  if (f.ano) q = q.eq("ano_fabricacao", f.ano);
  if (f.status) q = q.eq("status", f.status);
  if (f.semKm) q = q.is("km_atual", null);
  if (f.search) {
    const s = f.search.replace(/[%_]/g, "\\$&"); // escapa wildcards SQL
    q = q.or(
      `codigo_frota.ilike.%${s}%,placa.ilike.%${s}%,modelo.ilike.%${s}%,chassi.ilike.%${s}%,local.ilike.%${s}%`
    );
  }

  const { data, error } = await q.order("id", { ascending: true }).limit(5000);
  if (error) throw new Error(`listFrotas: ${error.message}`);

  const allRows = ((data ?? []) as VeiculoRow[]).map(fromVeiculo);

  // Filtros derivados que precisam de JS (condição, idade, cadastro)
  const filtered = allRows.filter((frota) => {
    if (f.operacional && f.operacional !== "baixado" && operacional(frota) !== f.operacional) return false;
    if (f.condicao && condition(frota) !== f.condicao) return false;
    if (f.cadastro === "incompleto" && !cadastroIncompleto(frota)) return false;
    if (f.idadeMin && (idade(frota) ?? -1) < f.idadeMin) return false;
    return true;
  });

  const offset = (page - 1) * pageSize;
  return { rows: filtered.slice(offset, offset + pageSize), total: filtered.length };
}

export async function listFrotasForReport(f: FrotaFilters = {}): Promise<Frota[]> {
  const { rows } = await listFrotas({ ...f, pageSize: 5000, page: 1 });
  return rows;
}

export async function getFrota(id: number): Promise<Frota | null> {
  const { data, error } = await supabaseManutencao.from("veiculos").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getFrota: ${error.message}`);
  return data ? fromVeiculo(data as VeiculoRow) : null;
}

export type KpisFiltro = {
  total: number;
  disponiveis: number;
  manutencao: number;
  indisponiveis: number;
};

export async function getKpisPorFiltro(localizacao: string): Promise<KpisFiltro> {
  const [total, disponiveis, manutencao, indisponiveis] = await Promise.all([
    supabaseManutencao.from("veiculos").select("id", { count: "exact", head: true })
      .eq("ativo", true).eq("vendido", false).eq("local", localizacao),
    supabaseManutencao.from("veiculos").select("id", { count: "exact", head: true })
      .eq("ativo", true).eq("vendido", false).eq("local", localizacao)
      .not("status", "in", '("manutencao","critico")'),
    supabaseManutencao.from("veiculos").select("id", { count: "exact", head: true })
      .eq("ativo", true).eq("vendido", false).eq("local", localizacao).eq("status", "manutencao"),
    supabaseManutencao.from("veiculos").select("id", { count: "exact", head: true })
      .eq("ativo", true).eq("vendido", false).eq("local", localizacao).eq("status", "critico"),
  ]);
  return {
    total: total.count ?? 0,
    disponiveis: disponiveis.count ?? 0,
    manutencao: manutencao.count ?? 0,
    indisponiveis: indisponiveis.count ?? 0,
  };
}

export async function kpis(): Promise<Kpis> {
  // Uma única query SQL agrega tudo no banco — sem transferir rows para JS
  // Antes: allFrotas() carregava ~300 rows; agora retorna 1 JSON
  const [kpiResult, prevResult] = await Promise.all([
    supabaseManutencao.rpc("get_frotas_kpis"),
    supabaseManutencao
      .from("fact_manutencao_programada")
      .select("tipo_servico, status")
      .in("status", ["VENCIDO", "PROXIMO_VENCIMENTO"]),
  ]);

  const raw = (kpiResult.data ?? {}) as Record<string, number | null>;
  const prev = prevResult.data ?? [];

  const total_ativos = Number(raw.total_ativos ?? 0);
  const total_disponiveis = Number(raw.total_disponiveis ?? 0);

  return {
    total_ativos,
    total_disponiveis,
    total_indisponiveis: Number(raw.total_indisponiveis ?? 0),
    total_atencao: Number(raw.total_atencao ?? 0),
    total_critico: Number(raw.total_critico ?? 0),
    total_manutencao: Number(raw.total_manutencao ?? 0),
    total_manutencao_atrasada: Number(raw.total_manutencao_atrasada ?? 0),
    total_manutencao_longa: Number(raw.total_manutencao_longa ?? 0),
    total_sem_km: Number(raw.total_sem_km ?? 0),
    total_acima_7: Number(raw.total_acima_7 ?? 0),
    total_cadastro_incompleto: Number(raw.total_cadastro_incompleto ?? 0),
    idade_media: raw.idade_media != null ? Number(raw.idade_media) : null,
    km_medio: raw.km_medio != null ? Number(raw.km_medio) : null,
    preventiva_atrasada: prev.filter((p) => p.tipo_servico === "PREVENTIVA_MOTOR" && p.status === "VENCIDO").length,
    alinhamento_atrasado: prev.filter((p) => p.tipo_servico === "ALINHAMENTO" && p.status === "VENCIDO").length,
    arcondicionado_atrasado: prev.filter((p) => p.tipo_servico === "AR_CONDICIONADO" && p.status === "VENCIDO").length,
    tacografo_atrasado: prev.filter((p) => p.tipo_servico === "TACOGRAFO" && p.status === "VENCIDO").length,
    lavagem_atrasada: prev.filter((p) => p.tipo_servico === "LAVAGEM" && p.status === "VENCIDO").length,
    disponibilidade_pct: total_ativos > 0
      ? Math.round((total_disponiveis / total_ativos) * 100)
      : 0,
  };
}

export async function modelosDistintos(): Promise<string[]> {
  // SQL DISTINCT em vez de carregar todas as frotas em memória
  const { data } = await supabaseManutencao
    .from("veiculos")
    .select("modelo")
    .eq("ativo", true)
    .eq("vendido", false)
    .not("modelo", "is", null)
    .order("modelo");
  return [...new Set((data ?? []).map((r: { modelo: string | null }) => r.modelo).filter(Boolean) as string[])];
}

export async function localizacoesDistintas(): Promise<string[]> {
  const { data } = await supabaseManutencao
    .from("veiculos")
    .select("local")
    .eq("ativo", true)
    .eq("vendido", false)
    .not("local", "is", null)
    .order("local");
  return [...new Set((data ?? []).map((r: { local: string | null }) => r.local).filter(Boolean) as string[])];
}

export async function statusBreakdown(): Promise<{ status: string; total: number }[]> {
  // Cache 30s — chamada múltiplas vezes por página, dados não precisam ser real-time
  return analyticsCache("statusBreakdown", 30_000, async () => {
    const counts = new Map<string, number>();
    for (const frota of await allFrotas()) {
      const key = operacional(frota);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, total]) => ({ status, total }));
  });
}

export async function frotasByYear(): Promise<{ ano: number | null; total: number }[]> {
  return analyticsCache("frotasByYear", 30_000, async () => {
    const counts = new Map<string, { ano: number | null; total: number }>();
    for (const frota of await allFrotas()) {
      const key = String(frota.ano_fabricacao ?? "sem_ano");
      const current = counts.get(key) ?? { ano: frota.ano_fabricacao, total: 0 };
      current.total += 1;
      counts.set(key, current);
    }
    return Array.from(counts.values()).sort((a, b) => (a.ano ?? 9999) - (b.ano ?? 9999));
  });
}

export async function conditionBreakdown(): Promise<{ status: string; total: number }[]> {
  return analyticsCache("conditionBreakdown", 30_000, async () => {
    const counts = new Map<string, number>();
    for (const frota of await allFrotas()) {
      const key = condition(frota);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, total]) => ({ status, total }));
  });
}

export async function createFrota(input: FrotaInput, userEmail: string): Promise<number> {
  const codigoFrota = input.frota_geral?.trim() || input.placa?.trim() || input.chassi?.trim() || `FROTA-${randomUUID()}`;
  const payload = {
    ...toVeiculoInput({ ...input, frota_geral: codigoFrota }, userEmail),
    vendido: false,
    ativo: true,
    status: input.status ?? "disponivel",
  };
  const { data, error } = await supabaseManutencao.from("veiculos").insert(payload).select("id").single();
  if (error) throw new Error(`createFrota: ${error.message}`);
  return Number(data.id);
}

export async function updateFrota(id: number, input: Partial<FrotaInput>, userEmail: string): Promise<void> {
  const current = await getFrota(id);
  if (!current) throw new Error(`Frota ${id} não encontrada`);

  for (const field of TRACKED_FIELDS) {
    if (field in input) {
      const novo = input[field];
      const antigo = current[field];
      if (String(novo ?? "") !== String(antigo ?? "")) {
        await appendHistorico(id, field === "km_atual" ? "km" : field, String(antigo ?? ""), String(novo ?? ""), userEmail);
      }
    }
  }

  const patch: Record<string, unknown> = {};
  for (const field of WRITABLE_FIELDS) {
    if (input[field] !== undefined) Object.assign(patch, toVeiculoInput({ [field]: input[field] }, userEmail));
  }
  if (Object.keys(patch).length === 0) return;
  patch.atualizado_por = userEmail;

  const { error } = await supabaseManutencao.from("veiculos").update(patch).eq("id", id);
  if (error) throw new Error(`updateFrota: ${error.message}`);
}

export type FrotaResumoChecklistInput = {
  km_atual?: number | null;
  km_origem?: string | null;
  km_validado?: boolean | null;
  ultimo_checklist_id?: number | null;
  ultimo_motorista_id?: string | null;
  ultimo_motorista_nome?: string | null;
  status?: StatusFrota | null;
  status_operacional?: string | null;
};

export async function aplicarResumoChecklist(
  frotaId: number,
  input: FrotaResumoChecklistInput,
  userEmail: string
): Promise<void> {
  const patch: Record<string, unknown> = { atualizado_por: userEmail };
  if (input.km_atual !== undefined) {
    patch.km_atual = input.km_atual;
    patch.km_atualizado_em = new Date().toISOString();
    patch.km_validado = input.km_validado ?? (input.km_origem === "CHECKLIST_INICIAL" ? false : true);
  }
  if (input.km_origem !== undefined) patch.km_origem = input.km_origem;
  if (input.ultimo_checklist_id !== undefined) {
    patch.ultimo_checklist_id = input.ultimo_checklist_id;
    patch.ultimo_checklist_em = new Date().toISOString();
  }
  if (input.ultimo_motorista_id !== undefined) patch.ultimo_motorista_id = input.ultimo_motorista_id;
  if (input.ultimo_motorista_nome !== undefined) patch.ultimo_motorista_nome = input.ultimo_motorista_nome;
  if (input.status !== undefined) patch.status = input.status;
  if (input.status_operacional !== undefined) patch.status_operacional = input.status_operacional;

  const { error } = await supabaseManutencao.from("veiculos").update(patch).eq("id", frotaId);
  if (error) throw new Error(`aplicarResumoChecklist: ${error.message}`);
}

export async function aplicarResumoAbastecimento(
  frotaId: number,
  litros: number | null,
  userEmail: string
): Promise<void> {
  const { error } = await supabaseManutencao
    .from("veiculos")
    .update({
      ultimo_abastecimento_em: new Date().toISOString(),
      ultimo_abastecimento_litros: litros,
      atualizado_por: userEmail,
    })
    .eq("id", frotaId);
  if (error) throw new Error(`aplicarResumoAbastecimento: ${error.message}`);
}

export async function softDeleteFrota(id: number, userEmail: string): Promise<void> {
  const { error } = await supabaseManutencao
    .from("veiculos")
    .update({ ativo: false, atualizado_por: userEmail })
    .eq("id", id);
  if (error) throw new Error(`softDeleteFrota: ${error.message}`);
}
