import { CHECKLIST_ITEMS, type ChecklistStatusGeral, type ChecklistStatusItem } from "@/lib/checklists/catalog";
import { gravidadePendencia, KM_VARIACAO_INCOMUM } from "@/lib/checklists/rules";
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { createAbastecimento } from "@/lib/repos/abastecimentos";
import { aplicarResumoAbastecimento, aplicarResumoChecklist, getFrota } from "@/lib/repos/frotas";
import {
  appendKmHistory,
  countPendingKmValidations,
  type KmOrigem,
} from "@/lib/repos/historico-km";

type VeiculoLite = {
  id: number;
  codigo_frota: string | null;
  placa: string | null;
  modelo: string | null;
  status: string | null;
  vendido: boolean | null;
  ativo: boolean | null;
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
};

async function safeSupabase<T>(label: string, cb: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await cb();
  } catch (error) {
    console.warn(`[checklists] ${label} indisponivel`, error);
    return fallback;
  }
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
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
      .select("*")
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
      .select("*")
      .order("criado_em", { ascending: false })
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
      .select("*")
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
    const [checklists, pendencias, divergencias] = await Promise.all([
      supabaseManutencao
        .from("checklists_frota")
        .select("status_geral")
        .gte("data_checklist", start)
        .lt("data_checklist", end),
      supabaseManutencao
        .from("pendencias_frota")
        .select("id", { count: "exact", head: true })
        .eq("gravidade", "CRITICA")
        .in("status", ["ABERTA", "EM_TRATATIVA"]),
      countPendingKmValidations().catch(() => 0),
    ]);

    if (checklists.error) throw checklists.error;
    if (pendencias.error) throw pendencias.error;

    const rows = (checklists.data ?? []) as Pick<ChecklistDbRow, "status_geral">[];
    return {
      total_hoje: rows.length,
      aprovados_hoje: rows.filter((row) => row.status_geral === "APROVADO").length,
      pendentes_hoje: rows.filter((row) => row.status_geral !== "APROVADO").length,
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

export async function listPortariaToday(): Promise<PortariaRow[]> {
  return safeSupabase("portaria", async () => {
    const { start, end } = todayRange();
    const [veiculosResult, checklistsResult, movimentosResult] = await Promise.all([
      supabaseManutencao
        .from("veiculos")
        .select("id,codigo_frota,placa,modelo,status,vendido,ativo")
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
    const checklistIds = checklists.map((row) => row.id);
    const pendencias = await fetchPendenciasCriticasByChecklistIds(checklistIds);

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
      };

      return { ...row, status_portaria: statusPortariaFromRow(row) };
    });
  }, []);
}

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
      usuario_portaria_id: input.usuario_portaria_id,
      observacao: input.observacao ?? null,
    });

  if (error) throw error;
}

function statusPortariaFromRow(row: Omit<PortariaRow, "status_portaria">): StatusPortaria {
  if (row.ultimo_tipo_movimentacao === "SAIDA") return "SAIDA_REGISTRADA";
  if (row.ultimo_tipo_movimentacao === "ENTRADA") return "ENTRADA_REGISTRADA";
  if (!row.checklist_id) return "PENDENTE_CHECKLIST";
  if (row.status_frota === "critico" || row.status_geral === "CRITICO" || row.pendencia_critica_item) {
    return "BLOQUEADA_CHECKLIST";
  }
  if (row.status_geral === "APROVADO") return "LIBERADA_SAIDA";
  return "CHECKLIST_REALIZADO";
}

export async function createChecklist(input: CreateChecklistInput): Promise<CreateChecklistResult> {
  const frotaAtual = await getFrota(input.frota_id);
  if (!frotaAtual) throw new Error(`Frota ${input.frota_id} nao encontrada`);

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
    if (error) throw error;
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
      ultimo_checklist_id: checklistId,
      ultimo_motorista_id: input.motorista_id,
      ultimo_motorista_nome: input.motorista_nome,
      status: statusFrota,
      status_operacional: statusOperacional,
    },
    input.motorista_id
  );

  const internalSecret = process.env.FROTAS_INTERNAL_SECRET;
  if (internalSecret) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
