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

async function allFrotas(): Promise<Frota[]> {
  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select("*")
    .order("id", { ascending: true })
    .limit(20000);
  if (error) throw new Error(`listFrotas: ${error.message}`);
  return ((data ?? []) as VeiculoRow[]).map(fromVeiculo);
}

export async function listFrotas(f: FrotaFilters = {}): Promise<{ rows: Frota[]; total: number }> {
  const { page, pageSize } = pagination(f);
  const filtered = (await allFrotas()).filter((frota) => matchesFilters(frota, f));
  const offset = (page - 1) * pageSize;
  return { rows: filtered.slice(offset, offset + pageSize), total: filtered.length };
}

export async function listFrotasForReport(f: FrotaFilters = {}): Promise<Frota[]> {
  return (await allFrotas()).filter((frota) => matchesFilters(frota, f));
}

export async function getFrota(id: number): Promise<Frota | null> {
  const { data, error } = await supabaseManutencao.from("veiculos").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getFrota: ${error.message}`);
  return data ? fromVeiculo(data as VeiculoRow) : null;
}

export async function kpis(): Promise<Kpis> {
  const frotas = (await allFrotas()).filter((frota) => frota.ativo && !frota.vendido);
  const ages = frotas.map(idade).filter((value): value is number => value != null);
  const kms = frotas.map((frota) => frota.km_atual).filter((value): value is number => value != null);
  const agora = Date.now();
  const LONGA_MS = 7 * 86400000;
  const emManutencao = frotas.filter((frota) => frota.status === "manutencao");
  return {
    total_ativos: frotas.length,
    total_disponiveis: frotas.filter((frota) => operacional(frota) === "disponivel").length,
    total_indisponiveis: frotas.filter((frota) => ["manutencao", "indisponivel"].includes(operacional(frota))).length,
    total_atencao: frotas.filter((frota) => condition(frota) === "atencao").length,
    total_critico: frotas.filter((frota) => condition(frota) === "critico").length,
    total_manutencao: emManutencao.length,
    total_manutencao_atrasada: emManutencao.filter((frota) => {
      if (!frota.manutencao_prev_retorno) return false;
      const d = new Date(frota.manutencao_prev_retorno).getTime();
      return Number.isFinite(d) && d < agora;
    }).length,
    total_manutencao_longa: emManutencao.filter((frota) => {
      if (!frota.manutencao_iniciado_em) return false;
      const d = new Date(frota.manutencao_iniciado_em).getTime();
      return Number.isFinite(d) && agora - d >= LONGA_MS;
    }).length,
    total_sem_km: frotas.filter((frota) => frota.km_atual == null).length,
    total_acima_7: frotas.filter((frota) => (idade(frota) ?? 0) >= 7).length,
    total_cadastro_incompleto: frotas.filter(cadastroIncompleto).length,
    idade_media: ages.length ? ages.reduce((sum, value) => sum + value, 0) / ages.length : null,
    km_medio: kms.length ? kms.reduce((sum, value) => sum + value, 0) / kms.length : null,
  };
}

export async function modelosDistintos(): Promise<string[]> {
  return Array.from(new Set((await allFrotas()).map((frota) => frota.modelo).filter(Boolean) as string[])).sort();
}

export async function localizacoesDistintas(): Promise<string[]> {
  return Array.from(new Set((await allFrotas()).map((frota) => frota.localizacao).filter(Boolean) as string[])).sort();
}

export async function statusBreakdown(): Promise<{ status: string; total: number }[]> {
  const counts = new Map<string, number>();
  for (const frota of (await allFrotas()).filter((item) => item.ativo && !item.vendido)) {
    const key = operacional(frota);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([status, total]) => ({ status, total }));
}

export async function frotasByYear(): Promise<{ ano: number | null; total: number }[]> {
  const counts = new Map<string, { ano: number | null; total: number }>();
  for (const frota of (await allFrotas()).filter((item) => item.ativo && !item.vendido)) {
    const key = String(frota.ano_fabricacao ?? "sem_ano");
    const current = counts.get(key) ?? { ano: frota.ano_fabricacao, total: 0 };
    current.total += 1;
    counts.set(key, current);
  }
  return Array.from(counts.values()).sort((a, b) => (a.ano ?? 9999) - (b.ano ?? 9999));
}

export async function conditionBreakdown(): Promise<{ status: string; total: number }[]> {
  const counts = new Map<string, number>();
  for (const frota of (await allFrotas()).filter((item) => item.ativo && !item.vendido)) {
    const key = condition(frota);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([status, total]) => ({ status, total }));
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
    patch.km_validado = input.km_origem === "CHECKLIST_INICIAL" ? false : true;
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
