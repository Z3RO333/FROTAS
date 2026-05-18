import { CHECKLIST_ITEMS, type ChecklistStatusGeral, type ChecklistStatusItem } from "@/lib/checklists/catalog";
import { gravidadePendencia, KM_VARIACAO_INCOMUM } from "@/lib/checklists/rules";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

// Colunas necessárias para listagem — exclui ocr_*, foto_km_url, observacao_*, analise_*
const COLS_CHECKLIST_LIST =
  "id,frota_id,motorista_id,motorista_nome,data_checklist,km_informado,status_geral,criado_em";

// Colunas de pendências para listagem
const COLS_PENDENCIA_LIST =
  "id,frota_id,checklist_id,item_nome,gravidade,status,criado_em,resolvido_em";
import { createAbastecimento } from "@/lib/repos/abastecimentos";
import { aplicarResumoAbastecimento, aplicarResumoChecklist, getFrota } from "@/lib/repos/frotas";
import {
  appendKmHistory,
  countPendingKmValidations,
  type KmOrigem,
} from "@/lib/repos/historico-km";
import { recordChecklistEnviado } from "@/lib/services/veiculo-eventos";

type VeiculoLite = {
  id: number;
  codigo_frota: string | null;
  placa: string | null;
  modelo: string | null;
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

async function safeSupabase<T>(label: string, cb: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await cb();
  } catch (error) {
    console.warn(`[checklists] ${label} indisponivel`, error);
    return fallback;
  }
}

// Calcula offset UTC em horas a partir do Intl.DateTimeFormat (ex: "GMT-4" → 4)
function getUtcOffsetHours(tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date());
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const m = tzName.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!m) return 0;
  const sign = m[1] === "+" ? 1 : -1;
  return -sign * (parseInt(m[2]) + (parseInt(m[3] ?? "0") / 60));
}

// dateStr: "YYYY-MM-DD" no timezone local. Se omitido, usa hoje.
function dateRange(dateStr?: string) {
  const tz = process.env.FROTAS_TIMEZONE ?? "America/Manaus";

  let year: number, month: number, day: number;

  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    [year, month, day] = dateStr.split("-").map(Number);
  } else {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    });
    [year, month, day] = fmt.format(new Date()).split("-").map(Number);
  }

  // Offset dinâmico — funciona para qualquer timezone, incluindo com DST
  const offsetHours = getUtcOffsetHours(tz);
  const start = new Date(Date.UTC(year, month - 1, day, offsetHours, 0, 0));
  const end = new Date(start.getTime() + 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function todayRange() {
  return dateRange();
}

async function fetchVeiculosByIds(ids: number[]): Promise<Map<number, VeiculoLite>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select("id,codigo_frota,placa,modelo,status,vendido,ativo")
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

export async function listAdminChecklists(limit = 100): Promise<ChecklistListRow[]> {
  return safeSupabase("listagem admin", async () => {
    const { data, error } = await supabaseManutencao
      .from("checklists_frota")
      .select(COLS_CHECKLIST_LIST)
      .order("criado_em", { ascending: false })
      .limit(limit);

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

  const { data, error } = await supabaseManutencao
    .from("checklists_frota")
    .select("*")
    .in("id", uniqueIds);

  if (error) throw error;
  return new Map(((data ?? []) as ChecklistDbRow[]).map((item) => [Number(item.id), item]));
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
        .select("*")
        .gte("data_checklist", start)
        .lt("data_checklist", end)
        .order("data_checklist", { ascending: false })
        .order("id", { ascending: false }),
      supabaseManutencao
        .from("movimentacoes_frota")
        .select("*")
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
  const { error } = await supabaseManutencao
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

  if (error) throw error;
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

  const { data: created, error: checklistError } = await supabaseManutencao
    .from("checklists_frota")
    .insert({
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
    })
    .select("id")
    .single();

  if (checklistError) throw checklistError;
  const checklistId = Number(created?.id);
  if (!checklistId) throw new Error("Checklist nao foi criado");

  // Wrapper que rola back o checklist criado se qualquer passo subsequente falhar
  // (Supabase JS não suporta transações; melhor que deixar checklist órfão sem itens)
  async function rollbackChecklist(reason: unknown) {
    try {
      await supabaseManutencao.from("checklists_frota").delete().eq("id", checklistId);
    } catch (delErr) {
      console.warn("[createChecklist] falha ao limpar checklist órfão", delErr);
    }
    throw reason;
  }

  const itensPayload = input.itens.flatMap((itemInput) => {
    const catalogItem = CHECKLIST_ITEMS.find((item) => item.codigo === itemInput.item_codigo);
    if (!catalogItem) return [];
    return [{
      checklist_id: checklistId,
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

  if (itensPayload.length > 0) {
    const { error } = await supabaseManutencao.from("checklist_itens").insert(itensPayload);
    if (error) await rollbackChecklist(error);
  }

  const pendenciasPayload = itensPayload
    .filter((item) => item.status === "NAO_APTO")
    .map((item) => ({
      frota_id: input.frota_id,
      checklist_id: checklistId,
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

  if (pendenciasPayload.length > 0) {
    const { error } = await supabaseManutencao.from("pendencias_frota").insert(pendenciasPayload);
    if (error) throw error;
  }

  await appendKmHistory({
    frota_id: input.frota_id,
    checklist_id: checklistId,
    motorista_id: input.motorista_id,
    motorista_nome: input.motorista_nome,
    km_anterior: kmAnterior,
    km_novo: input.km_informado,
    origem: kmOrigem,
    foto_km_url: input.foto_km_url ?? null,
    validado: kmAutoValidado,
  });

  let abastecimentoId: number | null = null;
  if ((input.litros_combustivel ?? 0) > 0 || (input.litros_arla ?? 0) > 0) {
    abastecimentoId = await createAbastecimento({
      frota_id: input.frota_id,
      motorista_id: input.motorista_id,
      motorista_nome: input.motorista_nome,
      checklist_id: checklistId,
      tipo_combustivel: input.tipo_combustivel ?? null,
      litros_combustivel: input.litros_combustivel ?? null,
      litros_arla: input.litros_arla ?? null,
      km_no_abastecimento: input.km_informado,
      foto_comprovante_url: input.foto_comprovante_abastecimento_url ?? null,
      origem: "CHECKLIST",
    });
    await aplicarResumoAbastecimento(
      input.frota_id,
      input.litros_combustivel ?? null,
      input.motorista_id
    );
  }

  const statusOperacional = resolveStatusOperacional(input.status_geral);
  const statusFrota = input.status_geral === "CRITICO" ? "critico" : undefined;

  await aplicarResumoChecklist(
    input.frota_id,
    {
      km_atual: input.km_informado,
      km_origem: kmOrigem,
      km_validado: kmAutoValidado,
      ultimo_checklist_id: checklistId,
      ultimo_motorista_id: input.motorista_id,
      ultimo_motorista_nome: input.motorista_nome,
      status: statusFrota,
      status_operacional: statusOperacional,
    },
    input.motorista_id
  );

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
    const baseUrl = process.env.FROTAS_APP_URL ?? "http://localhost:3000";
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
