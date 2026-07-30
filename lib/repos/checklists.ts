import { CHECKLIST_ITEMS, type ChecklistStatusGeral, type ChecklistStatusItem } from "@/lib/checklists/catalog";
import { gravidadePendencia, KM_VARIACAO_INCOMUM } from "@/lib/checklists/rules";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

// Colunas necessárias para listagem — exclui ocr_*, foto_km_url, observacao_*, analise_*
const COLS_CHECKLIST_LIST =
  "id,frota_id,motorista_id,motorista_nome,data_checklist,km_informado,status_geral,criado_em";

// Colunas de pendências para listagem
const COLS_PENDENCIA_LIST =
  "id,frota_id,checklist_id,item_nome,gravidade,status,criado_em,resolvido_em";
import { getFrota } from "@/lib/repos/frotas";
import { frotaEstaFora } from "@/lib/frota-derived";
import {
  countPendingKmValidations,
  type KmOrigem,
} from "@/lib/repos/historico-km";
import { recordChecklistEnviado } from "@/lib/services/veiculo-eventos";
import { getAppUrl } from "@/lib/app-url";
import { reportCalendarDate, reportDayUtcRange, shiftCalendarDate } from "@/lib/report-date";

type VeiculoLite = {
  id: number;
  codigo_frota: string | null;
  placa: string | null;
  modelo: string | null;
  local: string | null;
  status: string | null;
  vendido: boolean | null;
  ativo: boolean | null;
  manutencao_motivo?: string | null;
  manutencao_prev_retorno?: string | null;
  manutencao_bloqueia_checklist?: boolean | null;
};

type ChecklistDbRow = {
  id: number;
  frota_id: number;
  motorista_id: string;
  motorista_nome: string | null;
  data_checklist: string | null;
  km_informado: number | null;
  km_lido_ocr: number | null;
  ocr_confianca: number | null;
  km_confirmado: boolean | null;
  foto_km_url: string | null;
  status_geral: ChecklistStatusGeral;
  observacao_original: string | null;
  observacao_corrigida_ia: string | null;
  criado_em: string | null;
};

type PendenciaDbRow = {
  id: number;
  frota_id: number;
  checklist_id: number;
  item_nome: string;
  gravidade: string;
  status: string;
  responsavel_id: string | null;
  criado_em: string | null;
  resolvido_em: string | null;
};

type MovimentacaoDbRow = {
  id: number;
  frota_id: number;
  motorista_id: string | null;
  checklist_id: number | null;
  tipo_movimentacao: "SAIDA" | "ENTRADA" | null;
  data_hora: string | null;
  usuario_portaria_id: string | null;
  observacao: string | null;
};

export type ChecklistListRow = {
  id: number;
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  modelo: string | null;
  rota: string | null;
  motorista_id: string;
  motorista_nome: string | null;
  data_checklist: string | null;
  km_informado: number | null;
  km_lido_ocr: number | null;
  ocr_confianca: number | null;
  km_confirmado: boolean | null;
  foto_km_url: string | null;
  status_geral: ChecklistStatusGeral;
  observacao_original: string | null;
  observacao_corrigida_ia: string | null;
  criado_em: string | null;
};

export type ChecklistItemRow = {
  id: number;
  checklist_id: number;
  item_codigo: string;
  item_nome: string;
  grupo: string;
  status: ChecklistStatusItem;
  obrigatorio: boolean;
  critico: boolean;
  observacao: string | null;
  foto_url: string | null;
};

export type PendenciaRow = {
  id: number;
  frota_id: number;
  checklist_id: number;
  frota_geral: string | null;
  placa: string | null;
  motorista_id: string | null;
  motorista_nome: string | null;
  item_nome: string;
  gravidade: string;
  status: string;
  responsavel_id: string | null;
  criado_em: string | null;
  resolvido_em: string | null;
};

export type StatusPortaria =
  | "PENDENTE_CHECKLIST"
  | "CHECKLIST_REALIZADO"
  | "LIBERADA_SAIDA"
  | "BLOQUEADA_CHECKLIST"
  | "BLOQUEADA_MANUTENCAO"
  | "SAIDA_REGISTRADA"
  | "ENTRADA_REGISTRADA";

export type PortariaRow = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  modelo: string | null;
  status_frota: string | null;
  checklist_id: number | null;
  motorista_id: string | null;
  motorista_nome: string | null;
  data_checklist: string | null;
  km_informado: number | null;
  status_geral: ChecklistStatusGeral | null;
  pendencia_critica_item: string | null;
  ultimo_tipo_movimentacao: "SAIDA" | "ENTRADA" | null;
  ultimo_movimento_em: string | null;
  manutencao_motivo: string | null;
  manutencao_prev_retorno: string | null;
  status_portaria: StatusPortaria;
};

export type ChecklistItemInput = {
  item_codigo: string;
  status: ChecklistStatusItem;
  observacao?: string | null;
  foto_url?: string | null;
};

export type CreateChecklistInput = {
  submission_id: string;
  frota_id: number;
  motorista_id: string;
  motorista_nome: string;
  km_informado: number;
  km_lido_ocr?: number | null;
  ocr_confianca?: number | null;
  km_confirmado: boolean;
  foto_km_url?: string | null;
  status_geral: ChecklistStatusGeral;
  observacao_original?: string | null;
  observacao_corrigida_ia?: string | null;
  itens: ChecklistItemInput[];
  tipo_combustivel?: string | null;
  litros_combustivel?: number | null;
  litros_arla?: number | null;
  nivel_combustivel?: number | null;
  nivel_arla?: number | null;
  foto_comprovante_abastecimento_url?: string | null;
};

export type CreateChecklistResult = {
  checklist_id: number;
  km_origem: KmOrigem;
  km_validado: boolean;
  status_operacional: string;
  abastecimento_id: number | null;
};

export type RegistrarMovimentacaoInput = {
  frota_id: number;
  motorista_id: string;
  checklist_id: number;
  tipo_movimentacao: "SAIDA" | "ENTRADA";
  usuario_portaria_id: string;
  observacao?: string | null;
  tipo_acao?: string | null;
  motivo_bloqueio?: string | null;
};

async function safeSupabase<T>(label: string, cb: () => Promise<T>, _fallback: T): Promise<T> {
  try {
    return await cb();
  } catch (error) {
    void _fallback;
    throw new Error(`[checklists] ${label} indisponível`, { cause: error });
  }
}

// dateStr: "YYYY-MM-DD" no timezone local. Se omitido, usa hoje.
function dateRange(dateStr?: string) {
  return reportDayUtcRange(dateStr ?? reportCalendarDate());
}

function todayRange() {
  return dateRange();
}

function hojeStr(): string {
  return reportCalendarDate();
}

function somaDias(dataStr: string, dias: number): string {
  return shiftCalendarDate(dataStr, dias);
}

export type PeriodoChecklist = "hoje" | "ontem" | "semana_atual" | "semana_passada" | "ultimos_30_dias";

// Converte um preset de período em datas "YYYY-MM-DD" (inclusive) para filtrar listAdminChecklists.
export function periodoParaDatas(periodo: string | undefined): ChecklistListFilters {
  const hoje = hojeStr();
  switch (periodo as PeriodoChecklist) {
    case "hoje":
      return { dataInicio: hoje, dataFim: hoje };
    case "ontem": {
      const ontem = somaDias(hoje, -1);
      return { dataInicio: ontem, dataFim: ontem };
    }
    case "semana_atual": {
      const diaSemana = new Date(`${hoje}T00:00:00Z`).getUTCDay(); // 0=domingo
      const offsetSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
      return { dataInicio: somaDias(hoje, -offsetSegunda), dataFim: hoje };
    }
    case "semana_passada": {
      const diaSemana = new Date(`${hoje}T00:00:00Z`).getUTCDay();
      const offsetSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
      const segundaAtual = somaDias(hoje, -offsetSegunda);
      return { dataInicio: somaDias(segundaAtual, -7), dataFim: somaDias(segundaAtual, -1) };
    }
    case "ultimos_30_dias":
      return { dataInicio: somaDias(hoje, -29), dataFim: hoje };
    default:
      return {};
  }
}

async function fetchVeiculosByIds(ids: number[]): Promise<Map<number, VeiculoLite>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select("id,codigo_frota,placa,modelo,local,status,vendido,ativo")
    .in("id", uniqueIds);

  if (error) throw error;
  return new Map((data ?? []).map((item) => [Number(item.id), item as VeiculoLite]));
}

function mapChecklist(row: ChecklistDbRow, veiculo?: VeiculoLite): ChecklistListRow {
  return {
    ...row,
    frota_geral: veiculo?.codigo_frota ?? null,
    placa: veiculo?.placa ?? null,
    modelo: veiculo?.modelo ?? null,
    rota: veiculo?.local ?? null,
  };
}

export async function listDriverChecklists(email: string, limit = 20): Promise<ChecklistListRow[]> {
  return safeSupabase("listagem do motorista", async () => {
    const { data, error } = await supabaseManutencao
      .from("checklists_frota")
      .select(COLS_CHECKLIST_LIST)
      .eq("motorista_id", email)
      .order("criado_em", { ascending: false })
      .limit(limit);

    if (error) throw error;
    const rows = (data ?? []) as ChecklistDbRow[];
    const veiculos = await fetchVeiculosByIds(rows.map((row) => row.frota_id));
    return rows.map((row) => mapChecklist(row, veiculos.get(row.frota_id)));
  }, []);
}

export type ChecklistListFilters = {
  // "YYYY-MM-DD" no timezone da operação (FROTAS_TIMEZONE)
  dataInicio?: string;
  dataFim?: string;
  // A rota operacional é representada pelo campo `local` do veículo.
  rota?: string;
};

export async function listChecklistRoutes(): Promise<string[]> {
  return safeSupabase("rotas de checklist", async () => {
    const { data, error } = await supabaseManutencao
      .from("veiculos")
      .select("local")
      .eq("ativo", true)
      .eq("vendido", false)
      .not("local", "is", null)
      .order("local", { ascending: true });

    if (error) throw error;
    return [...new Set((data ?? []).map((item) => String(item.local ?? "").trim()).filter(Boolean))];
  }, []);
}

export async function listAdminChecklists(
  limit = 100,
  filters: ChecklistListFilters = {}
): Promise<ChecklistListRow[]> {
  return safeSupabase("listagem admin", async () => {
    let frotaIdsDaRota: number[] | null = null;
    if (filters.rota) {
      const { data: veiculosDaRota, error: rotaError } = await supabaseManutencao
        .from("veiculos")
        .select("id")
        .eq("local", filters.rota);
      if (rotaError) throw rotaError;
      frotaIdsDaRota = (veiculosDaRota ?? []).map((item) => Number(item.id)).filter(Number.isFinite);
      if (frotaIdsDaRota.length === 0) return [];
    }

    let query = supabaseManutencao
      .from("checklists_frota")
      .select(COLS_CHECKLIST_LIST)
      .order("criado_em", { ascending: false })
      .limit(limit);

    if (filters.dataInicio) query = query.gte("data_checklist", dateRange(filters.dataInicio).start);
    if (filters.dataFim) query = query.lt("data_checklist", dateRange(filters.dataFim).end);
    if (frotaIdsDaRota) query = query.in("frota_id", frotaIdsDaRota);

    const { data, error } = await query;

    if (error) throw error;
    const rows = (data ?? []) as ChecklistDbRow[];
    const veiculos = await fetchVeiculosByIds(rows.map((row) => row.frota_id));
    return rows.map((row) => mapChecklist(row, veiculos.get(row.frota_id)));
  }, []);
}

export async function listChecklistsByFrota(frotaId: number, limit = 10): Promise<ChecklistListRow[]> {
  return safeSupabase("checklists da frota", async () => {
    const { data, error } = await supabaseManutencao
      .from("checklists_frota")
      .select(COLS_CHECKLIST_LIST)
      .eq("frota_id", frotaId)
      .order("data_checklist", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);

    if (error) throw error;
    const rows = (data ?? []) as ChecklistDbRow[];
    const veiculos = await fetchVeiculosByIds(rows.map((row) => row.frota_id));
    return rows.map((row) => mapChecklist(row, veiculos.get(row.frota_id)));
  }, []);
}

export async function listChecklistItems(checklistId: number): Promise<ChecklistItemRow[]> {
  return safeSupabase("itens do checklist", async () => {
    const { data, error } = await supabaseManutencao
      .from("checklist_itens")
      .select("*")
      .eq("checklist_id", checklistId)
      .order("id", { ascending: true });

    if (error) throw error;
    return (data ?? []) as ChecklistItemRow[];
  }, []);
}

export async function listOpenPendencias(limit = 100): Promise<PendenciaRow[]> {
  return safeSupabase("pendencias abertas", async () => {
    const { data, error } = await supabaseManutencao
      .from("pendencias_frota")
      .select(COLS_PENDENCIA_LIST)
      .in("status", ["ABERTA", "EM_TRATATIVA"])
      .order("criado_em", { ascending: false })
      .limit(limit);

    if (error) throw error;
    const pendencias = (data ?? []) as PendenciaDbRow[];
    const [veiculos, checklists] = await Promise.all([
      fetchVeiculosByIds(pendencias.map((row) => row.frota_id)),
      fetchChecklistsByIds(pendencias.map((row) => row.checklist_id)),
    ]);

    return pendencias.map((row) => {
      const checklist = checklists.get(row.checklist_id);
      const veiculo = veiculos.get(row.frota_id);
      return {
        ...row,
        frota_geral: veiculo?.codigo_frota ?? null,
        placa: veiculo?.placa ?? null,
        motorista_id: checklist?.motorista_id ?? null,
        motorista_nome: checklist?.motorista_nome ?? null,
      };
    });
  }, []);
}

export async function listPendenciasByFrota(frotaId: number, limit = 20): Promise<PendenciaRow[]> {
  return safeSupabase("pendencias da frota", async () => {
    const { data, error } = await supabaseManutencao
      .from("pendencias_frota")
      .select(COLS_PENDENCIA_LIST)
      .eq("frota_id", frotaId)
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);

    if (error) throw error;
    const pendencias = (data ?? []) as PendenciaDbRow[];
    const [veiculos, checklists] = await Promise.all([
      fetchVeiculosByIds(pendencias.map((row) => row.frota_id)),
      fetchChecklistsByIds(pendencias.map((row) => row.checklist_id)),
    ]);

    return pendencias.map((row) => {
      const checklist = checklists.get(row.checklist_id);
      const veiculo = veiculos.get(row.frota_id);
      return {
        ...row,
        frota_geral: veiculo?.codigo_frota ?? null,
        placa: veiculo?.placa ?? null,
        motorista_id: checklist?.motorista_id ?? null,
        motorista_nome: checklist?.motorista_nome ?? null,
      };
    });
  }, []);
}

async function fetchChecklistsByIds(ids: number[]): Promise<Map<number, ChecklistDbRow>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  // Apenas colunas usadas downstream (motorista_id, motorista_nome) — evita transferir
  // observacao_original/observacao_corrigida_ia que podem ser longas.
  const { data, error } = await supabaseManutencao
    .from("checklists_frota")
    .select("id,motorista_id,motorista_nome")
    .in("id", uniqueIds);

  if (error) throw error;
  return new Map(
    ((data ?? []) as Array<Pick<ChecklistDbRow, "id" | "motorista_id" | "motorista_nome">>).map(
      (item) => [Number(item.id), item as ChecklistDbRow]
    )
  );
}

export async function checklistDashboardKpis(): Promise<{
  total_hoje: number;
  aprovados_hoje: number;
  pendentes_hoje: number;
  criticos_abertos: number;
  divergencias_km: number;
}> {
  return safeSupabase("kpis", async () => {
    const { start, end } = todayRange();
    // 4 queries de COUNT em paralelo — só conta no banco, não transfere rows
    const [totalRes, aprovadosRes, pendencias, divergencias] = await Promise.all([
      supabaseManutencao
        .from("checklists_frota")
        .select("id", { count: "exact", head: true })
        .gte("data_checklist", start)
        .lt("data_checklist", end),
      supabaseManutencao
        .from("checklists_frota")
        .select("id", { count: "exact", head: true })
        .eq("status_geral", "APROVADO")
        .gte("data_checklist", start)
        .lt("data_checklist", end),
      supabaseManutencao
        .from("pendencias_frota")
        .select("id", { count: "exact", head: true })
        .eq("gravidade", "CRITICA")
        .in("status", ["ABERTA", "EM_TRATATIVA"]),
      countPendingKmValidations().catch(() => 0),
    ]);

    if (totalRes.error) throw totalRes.error;
    if (aprovadosRes.error) throw aprovadosRes.error;
    if (pendencias.error) throw pendencias.error;

    const total_hoje = totalRes.count ?? 0;
    const aprovados_hoje = aprovadosRes.count ?? 0;
    return {
      total_hoje,
      aprovados_hoje,
      pendentes_hoje: total_hoje - aprovados_hoje,
      criticos_abertos: pendencias.count ?? 0,
      divergencias_km: Number(divergencias ?? 0),
    };
  }, {
    total_hoje: 0,
    aprovados_hoje: 0,
    pendentes_hoje: 0,
    criticos_abertos: 0,
    divergencias_km: 0,
  });
}

export async function listPortariaForDate(dateStr?: string): Promise<PortariaRow[]> {
  return safeSupabase("portaria", async () => {
    const { start, end } = dateRange(dateStr);
    const isFuture = new Date(start) > new Date();
    if (isFuture) return []; // não busca datas futuras
    // 3 queries em paralelo
    const [veiculosResult, checklistsResult, movimentosResult] = await Promise.all([
      supabaseManutencao
        .from("veiculos")
        .select(
          "id,codigo_frota,placa,modelo,status,vendido,ativo,manutencao_motivo,manutencao_prev_retorno,manutencao_bloqueia_checklist"
        )
        .eq("ativo", true)
        .eq("vendido", false)
        .order("codigo_frota", { ascending: true }),
      supabaseManutencao
        .from("checklists_frota")
        .select("id,frota_id,motorista_id,motorista_nome,data_checklist,km_informado,status_geral")
        .gte("data_checklist", start)
        .lt("data_checklist", end)
        .order("data_checklist", { ascending: false })
        .order("id", { ascending: false }),
      supabaseManutencao
        .from("movimentacoes_frota")
        .select("id,frota_id,checklist_id,tipo_movimentacao,data_hora")
        .gte("data_hora", start)
        .lt("data_hora", end)
        .order("data_hora", { ascending: false })
        .order("id", { ascending: false }),
    ]);

    if (veiculosResult.error) throw veiculosResult.error;
    if (checklistsResult.error) throw checklistsResult.error;
    if (movimentosResult.error) throw movimentosResult.error;

    const veiculos = (veiculosResult.data ?? []) as VeiculoLite[];
    const checklists = (checklistsResult.data ?? []) as ChecklistDbRow[];
    const movimentos = (movimentosResult.data ?? []) as MovimentacaoDbRow[];

    // Pendências críticas — só roda se houver checklists, evita query desnecessária
    const checklistIds = checklists.map((row) => row.id);
    const pendencias = checklistIds.length > 0
      ? await fetchPendenciasCriticasByChecklistIds(checklistIds)
      : new Map<number, string>();

    const checklistByFrota = new Map<number, ChecklistDbRow>();
    for (const checklist of checklists) {
      if (!checklistByFrota.has(checklist.frota_id)) {
        checklistByFrota.set(checklist.frota_id, checklist);
      }
    }

    const movimentoByFrota = new Map<number, MovimentacaoDbRow>();
    for (const movimento of movimentos) {
      if (!movimentoByFrota.has(movimento.frota_id)) {
        movimentoByFrota.set(movimento.frota_id, movimento);
      }
    }

    return veiculos.map((veiculo) => {
      const checklist = checklistByFrota.get(veiculo.id);
      const movimento = movimentoByFrota.get(veiculo.id);
      const row: Omit<PortariaRow, "status_portaria"> = {
        frota_id: veiculo.id,
        frota_geral: veiculo.codigo_frota,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        status_frota: veiculo.status,
        checklist_id: checklist?.id ?? null,
        motorista_id: checklist?.motorista_id ?? null,
        motorista_nome: checklist?.motorista_nome ?? null,
        data_checklist: checklist?.data_checklist ?? null,
        km_informado: checklist?.km_informado ?? null,
        status_geral: checklist?.status_geral ?? null,
        pendencia_critica_item: checklist ? pendencias.get(checklist.id) ?? null : null,
        ultimo_tipo_movimentacao: movimento?.tipo_movimentacao ?? null,
        ultimo_movimento_em: movimento?.data_hora ?? null,
        manutencao_motivo: veiculo.manutencao_motivo ?? null,
        manutencao_prev_retorno: veiculo.manutencao_prev_retorno ?? null,
      };

      const emManutencao =
        veiculo.status === "manutencao" && veiculo.manutencao_bloqueia_checklist !== false;

      return {
        ...row,
        status_portaria: emManutencao
          ? "BLOQUEADA_MANUTENCAO"
          : statusPortariaFromRow(row),
      };
    });
  }, []);
}

/** Alias para compatibilidade com código existente que importa listPortariaToday */
export const listPortariaToday = () => listPortariaForDate();

async function fetchPendenciasCriticasByChecklistIds(ids: number[]): Promise<Map<number, string>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabaseManutencao
    .from("pendencias_frota")
    .select("checklist_id,item_nome")
    .in("checklist_id", uniqueIds)
    .eq("gravidade", "CRITICA")
    .in("status", ["ABERTA", "EM_TRATATIVA"])
    .order("id", { ascending: true });

  if (error) throw error;
  const map = new Map<number, string>();
  for (const row of data ?? []) {
    if (!map.has(Number(row.checklist_id))) {
      map.set(Number(row.checklist_id), String(row.item_nome ?? ""));
    }
  }
  return map;
}

export async function registrarMovimentacaoFrota(input: RegistrarMovimentacaoInput): Promise<void> {
  // RPC idempotente (migration 023): serializa por frota e descarta duplicata
  // dentro de ~10s, matando movimentação dupla por duplo-clique/double-submit.
  const { error } = await supabaseManutencao.rpc("registrar_movimentacao_idempotente", {
    p_frota_id: input.frota_id,
    p_motorista_id: input.motorista_id,
    p_checklist_id: input.checklist_id,
    p_tipo_movimentacao: input.tipo_movimentacao,
    p_usuario_portaria_id: input.usuario_portaria_id,
    p_observacao: input.observacao ?? null,
    p_tipo_acao: input.tipo_acao ?? input.tipo_movimentacao,
    p_motivo_bloqueio: input.motivo_bloqueio ?? null,
  });

  if (!error) return;

  // Fallback inseguro (sem dedupe) apenas quando a RPC não existe — dev sem
  // migrations aplicadas. Em produção a RPC sempre existe.
  if (!/function .* does not exist/i.test(error.message)) {
    throw new Error(`registrarMovimentacaoFrota: ${error.message}`, { cause: error });
  }
  console.warn("[portaria] RPC registrar_movimentacao_idempotente ausente — usando insert direto");
  const { error: fbError } = await supabaseManutencao
    .from("movimentacoes_frota")
    .insert({
      frota_id: input.frota_id,
      motorista_id: input.motorista_id,
      checklist_id: input.checklist_id,
      tipo_movimentacao: input.tipo_movimentacao,
      data_hora: new Date().toISOString(),
      data_movimentacao: new Date().toISOString().slice(0, 10), // YYYY-MM-DD UTC
      usuario_portaria_id: input.usuario_portaria_id,
      observacao: input.observacao ?? null,
      tipo_acao: input.tipo_acao ?? input.tipo_movimentacao,
      motivo_bloqueio: input.motivo_bloqueio ?? null,
    });
  if (fbError) {
    throw new Error(`registrarMovimentacaoFrota: ${fbError.message}`, { cause: fbError });
  }
}

function statusPortariaFromRow(row: Omit<PortariaRow, "status_portaria">): StatusPortaria {
  // Se há movimentação, compara o timestamp com o do checklist.
  // Checklist mais recente que a movimentação → checklist prevalece (ex: novo checklist após ENTRADA).
  if (row.ultimo_tipo_movimentacao && row.ultimo_movimento_em) {
    const movTime = new Date(row.ultimo_movimento_em).getTime();
    const ckTime = row.data_checklist ? new Date(row.data_checklist).getTime() : 0;
    if (movTime >= ckTime) {
      if (row.ultimo_tipo_movimentacao === "SAIDA") return "SAIDA_REGISTRADA";
      if (row.ultimo_tipo_movimentacao === "ENTRADA") return "ENTRADA_REGISTRADA";
    }
  }

  if (!row.checklist_id) return "PENDENTE_CHECKLIST";

  // Regra de liberação: bloqueia apenas quando há itens OBRIGATÓRIOS inconforme.
  // status_geral = "NAO_APTO" → item obrigatório inconforme
  // status_geral = "CRITICO" → item obrigatório crítico inconforme
  // status_geral = "COM_OBSERVACAO" → apenas itens não-obrigatórios inconforme → LIBERA
  // status_geral = "APROVADO" → tudo ok → LIBERA
  if (row.status_geral === "NAO_APTO" || row.status_geral === "CRITICO") {
    return "BLOQUEADA_CHECKLIST";
  }

  // APROVADO ou COM_OBSERVACAO (não-obrigatórios) → liberado pela portaria
  if (row.status_geral === "APROVADO" || row.status_geral === "COM_OBSERVACAO") {
    return "LIBERADA_SAIDA";
  }

  return "CHECKLIST_REALIZADO";
}

export async function createChecklist(input: CreateChecklistInput): Promise<CreateChecklistResult> {
  const frotaAtual = await getFrota(input.frota_id);
  if (!frotaAtual) throw new Error(`Frota ${input.frota_id} nao encontrada`);

  if (frotaEstaFora(frotaAtual.status_operacional)) {
    throw new Error("Frota fora da base. Registre a entrada na portaria antes de criar outro checklist.");
  }

  // Bloqueio operacional: frota em manutenção não pode receber checklist
  if (
    frotaAtual.status === "manutencao" &&
    frotaAtual.manutencao_bloqueia_checklist !== false
  ) {
    throw new Error(
      `Frota em manutenção desde ${frotaAtual.manutencao_iniciado_em?.slice(0, 10) ?? "—"}: ${frotaAtual.manutencao_motivo ?? "sem motivo"}. Aguarde liberação ou contate o administrador.`
    );
  }
  if (frotaAtual.vendido) throw new Error("Frota vendida não pode receber checklist.");
  if (!frotaAtual.ativo) throw new Error("Frota inativa/baixada não pode receber checklist.");

  const kmAnterior = frotaAtual.km_atual;
  const isPrimeiroKm = kmAnterior == null;
  const diff = kmAnterior != null ? input.km_informado - kmAnterior : null;
  const variacaoIncomum = diff != null && diff > KM_VARIACAO_INCOMUM;
  const kmMenor = diff != null && diff < 0;

  const kmOrigem: KmOrigem = isPrimeiroKm ? "CHECKLIST_INICIAL" : "CHECKLIST_MOTORISTA";
  const kmAutoValidado = !isPrimeiroKm && !variacaoIncomum && !kmMenor;

  // Monta os payloads (lógica de negócio em JS); a persistência de
  // checklist + itens + pendências + histórico de KM é atômica via RPC
  // criar_checklist_atomico (migration 022). Antes, INSERTs sequenciais sem
  // transação podiam deixar estado parcial (ex.: checklist sem pendência).
  const itensPayload = input.itens.flatMap((itemInput) => {
    const catalogItem = CHECKLIST_ITEMS.find((item) => item.codigo === itemInput.item_codigo);
    if (!catalogItem) return [];
    return [{
      item_codigo: catalogItem.codigo,
      item_nome: catalogItem.nome,
      grupo: catalogItem.grupo,
      status: itemInput.status,
      obrigatorio: catalogItem.obrigatorio,
      critico: catalogItem.critico,
      observacao: itemInput.observacao ?? null,
      foto_url: itemInput.foto_url ?? null,
    }];
  });

  const pendenciasPayload = itensPayload
    .filter((item) => item.status === "NAO_APTO")
    .map((item) => ({
      frota_id: input.frota_id,
      item_nome: item.item_nome,
      gravidade: gravidadePendencia({
        codigo: item.item_codigo,
        nome: item.item_nome,
        grupo: item.grupo,
        obrigatorio: item.obrigatorio,
        critico: item.critico,
      }),
      status: "ABERTA",
      responsavel_id: null,
      resolvido_em: null,
    }));

  const kmHistoryPayload = {
    frota_id: input.frota_id,
    motorista_id: input.motorista_id,
    motorista_nome: input.motorista_nome,
    km_anterior: kmAnterior,
    km_novo: input.km_informado,
    diferenca_km: kmAnterior != null ? input.km_informado - kmAnterior : null,
    origem: kmOrigem,
    foto_km_url: input.foto_km_url ?? null,
    validado: kmAutoValidado,
    validado_por: null,
    validado_em: kmAutoValidado ? new Date().toISOString() : null,
  };

  const statusOperacional = resolveStatusOperacional(input.status_geral);
  const statusFrota = input.status_geral === "CRITICO" ? "critico" : null;

  const { data: rpcResult, error: rpcError } = await supabaseManutencao.rpc(
    "criar_checklist_atomico_v2",
    {
      p_checklist: {
        submission_id: input.submission_id,
        frota_id: input.frota_id,
        motorista_id: input.motorista_id,
        motorista_nome: input.motorista_nome,
        data_checklist: new Date().toISOString(),
        km_informado: input.km_informado,
        km_lido_ocr: input.km_lido_ocr ?? null,
        ocr_confianca: input.ocr_confianca ?? null,
        km_confirmado: input.km_confirmado,
        foto_km_url: input.foto_km_url ?? null,
        status_geral: input.status_geral,
        observacao_original: input.observacao_original ?? null,
        observacao_corrigida_ia: input.observacao_corrigida_ia ?? null,
      },
      p_itens: itensPayload,
      p_pendencias: pendenciasPayload,
      p_km_history: kmHistoryPayload,
      p_abastecimento: {
        motorista_id: input.motorista_id,
        motorista_nome: input.motorista_nome,
        tipo_combustivel: input.tipo_combustivel ?? null,
        litros_combustivel: input.litros_combustivel ?? null,
        litros_arla: input.litros_arla ?? null,
        km_no_abastecimento: input.km_informado,
        foto_comprovante_url: input.foto_comprovante_abastecimento_url ?? null,
      },
      p_vehicle_summary: {
        km_atual: input.km_informado,
        km_origem: kmOrigem,
        km_validado: kmAutoValidado,
        motorista_id: input.motorista_id,
        motorista_nome: input.motorista_nome,
        status: statusFrota,
        status_operacional: statusOperacional,
        nivel_combustivel: input.nivel_combustivel ?? null,
        nivel_arla: input.nivel_arla ?? null,
        litros_combustivel: input.litros_combustivel ?? null,
      },
    }
  );

  if (rpcError) throw new Error(`createChecklist: ${rpcError.message}`);
  const result = rpcResult as { checklist_id?: number; abastecimento_id?: number | null } | null;
  const checklistId = Number(result?.checklist_id);
  if (!checklistId) throw new Error("Checklist nao foi criado");
  const abastecimentoId = result?.abastecimento_id ?? null;

  // Event sourcing — registra eventos do checklist no veículo
  const itensNaoAptos = itensPayload.filter((i) => i.status === "NAO_APTO");
  const itensCriticos = itensNaoAptos.filter((i) => i.critico);
  await recordChecklistEnviado({
    checklist_id: checklistId,
    veiculo_id: input.frota_id,
    motorista_id: input.motorista_id,
    status_geral: input.status_geral,
    km_anterior: kmAnterior,
    km_novo: input.km_informado,
    km_diff: diff,
    km_validado: kmAutoValidado,
    litros_combustivel: input.litros_combustivel ?? null,
    nivel_combustivel: input.nivel_combustivel ?? null,
    nivel_arla: input.nivel_arla ?? null,
    itens_nao_aptos: itensNaoAptos.length,
    itens_criticos: itensCriticos.length,
  }).catch((err) => console.warn("[veiculo-eventos] falha", err));

  const internalSecret = process.env.FROTAS_INTERNAL_SECRET;
  if (internalSecret) {
    const baseUrl = getAppUrl();
    fetch(`${baseUrl}/api/checklists/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({ checklist_id: checklistId }),
    }).catch((err) => console.warn("[analyze] falha ao disparar análise assíncrona", err));
  }

  return {
    checklist_id: checklistId,
    km_origem: kmOrigem,
    km_validado: kmAutoValidado,
    status_operacional: statusOperacional,
    abastecimento_id: abastecimentoId,
  };
}

function resolveStatusOperacional(status: ChecklistStatusGeral): string {
  switch (status) {
    case "CRITICO":
    case "NAO_APTO":
      return "BLOQUEADA_CHECKLIST";
    case "COM_OBSERVACAO":
      return "PENDENTE_ANALISE";
    case "APROVADO":
    default:
      return "LIBERADA";
  }
}
