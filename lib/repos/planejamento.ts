import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { calculateDateSchedule, calendarDate } from "@/lib/maintenance-schedule";
import { reportCalendarDate } from "@/lib/report-date";
import { listFrotasForReport } from "@/lib/repos/frotas";
import { mesLicenciamentoPorPlaca } from "@/lib/crlv-calendario";
import { getManutencaoStatus, type ManutencaoStatusRow } from "@/lib/repos/manutencao/status";

export type PlanejamentoOverview = {
  crlv_vencidos: number;
  crlv_ja_vencidos: number;
  sem_dut: number;
  manut_atrasadas: number;
  manut_ok: number;
  lavagem_atrasada: number;
  pneus_total: number;
  sem_estepe: number;
  disp_hoje: number | null;
  disp_meta: number | null;
  sem_kit_completo: number;
};

export type DocumentoRow = {
  equipamento: string | null;
  placa: string | null;
  frota_numero: string | null;
  tipo_documento: string;
  data_vencimento: string | null;
  dias_passados: number | null;
  status: string | null;
  link_documento: string | null;
  localizacao: string | null;
};

export type DisponibilidadeRow = {
  data: string;
  total: number | null;
  parados: number | null;
  disponibilidade: number | null;
  meta: number | null;
};

export type DisponibilidadeTipoRow = {
  tipo_equipamento: string;
  total: number | null;
  parados: number | null;
  disponibilidade: number | null;
};

export type PneuRow = {
  equipamento: string | null;
  frota_numero: string | null;
  posicao: string;
  numero_fogo: string | null;
  marca: string | null;
  dt_montagem: string | null;
  status: string | null;
  marcado: boolean | null;
  numero_fogo_anterior?: string | null;
  marca_anterior?: string | null;
};

export type LavagemRow = {
  equipamento: string | null;
  placa: string | null;
  frota_numero: string | null;
  setor: string | null;
  data_realizada: string | null;
  proxima_data: string | null;
  intervalo_dias: number;
  quilometragem: number | null;
  observacoes: string | null;
  atraso_dias: number | null;
  status: string | null;
};

export type KitSegurancaRow = {
  equipamento: string | null;
  placa: string | null;
  frota_numero: string | null;
  setor: string | null;
  triangulo_ok: boolean | null;
  extintor_ok: boolean | null;
  macaco_ok: boolean | null;
  chave_roda_ok: boolean | null;
};

export type BateriaRow = {
  equipamento: string | null;
  placa: string | null;
  frota_numero: string | null;
  setor: string | null;
  data_compra: string | null;
  modelo_bateria: string | null;
  loja: string | null;
};

export type EstepeRow = {
  frota_numero: string | null;
  placa: string | null;
  modelo: string | null;
  setor: string | null;
  tem_estepe: boolean | null;
  data_verificacao: string | null;
};

// O campo crlv_vencimento (Central de Documentos) só é atualizado quando alguém
// sobe o novo CRLV depois da renovação anual — não dá pra tratar como uma data de
// validade simples, porque o ano cadastrado só reflete a renovação mais recente
// quando já é o ano do ciclo devido pra aquele final de placa. Por isso cruza com
// o calendário: se o mês de licenciamento da placa já passou este ano e o ano
// cadastrado ainda não é o ano atual, está vencido de verdade.
function crlvRealmenteVencido(placa: string | null, crlvVencimento: string | null, hoje: Date): boolean {
  const mes = mesLicenciamentoPorPlaca(placa);
  if (mes == null) return false;

  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  const anoCicloDevido = mesAtual >= mes ? anoAtual : anoAtual - 1;

  if (!crlvVencimento) return true;
  const anoRegistro = new Date(`${crlvVencimento}T00:00:00`).getFullYear();
  return anoRegistro < anoCicloDevido;
}

export async function getPlanejamentoOverview(): Promise<PlanejamentoOverview> {
  const [frotasAtivas, documentos, manutRows, lavagem, pneus, estepes, kit, disp] = await Promise.all([
    listFrotasForReport(),
    supabaseManutencao.from("documents").select("frota,placa,dut_url,crlv_vencimento"),
    getManutencaoStatus(),
    getLavagem(),
    supabaseManutencao.from("fact_pneus").select("id", { count: "exact", head: true }),
    supabaseManutencao.from("fact_estepes").select("tem_estepe"),
    supabaseManutencao.from("fact_kit_seguranca").select("triangulo_ok,extintor_ok,macaco_ok,chave_roda_ok"),
    supabaseManutencao.from("fact_disponibilidade_diaria").select("disponibilidade,meta").order("data", { ascending: false }).limit(1),
  ]);
  const overviewError = documentos.error ?? pneus.error ?? estepes.error ?? kit.error ?? disp.error;
  if (overviewError) throw new Error(`getPlanejamentoOverview: ${overviewError.message}`);

  const docRows = (documentos.data ?? []) as Array<{ frota: string | null; placa: string | null; dut_url: string | null; crlv_vencimento: string | null }>;
  const docPorFrota = new Map(docRows.map((d) => [d.frota, d]));
  const lavRows = lavagem;
  const estRows = (estepes.data ?? []) as Array<{ tem_estepe: boolean | null }>;
  const kitRows = (kit.data ?? []) as Array<{ triangulo_ok: boolean | null; extintor_ok: boolean | null; macaco_ok: boolean | null; chave_roda_ok: boolean | null }>;
  const dispRow = (disp.data ?? [])[0] as { disponibilidade: number | null; meta: number | null } | undefined;

  const hoje = new Date();
  let crlvVencidos = 0;
  let crlvJaVencidos = 0;
  let semDut = 0;
  for (const frota of frotasAtivas) {
    const doc = frota.frota_geral ? docPorFrota.get(frota.frota_geral) : undefined;
    if (crlvRealmenteVencido(doc?.placa ?? frota.placa, doc?.crlv_vencimento ?? null, hoje)) crlvVencidos += 1;
    if (doc?.crlv_vencimento && new Date(`${doc.crlv_vencimento}T00:00:00`) < hoje) crlvJaVencidos += 1;
    if (!doc?.dut_url) semDut += 1;
  }

  return {
    crlv_vencidos: crlvVencidos,
    crlv_ja_vencidos: crlvJaVencidos,
    sem_dut: semDut,
    manut_atrasadas: manutRows.filter((r) => r.status === "VENCIDO").length,
    manut_ok: manutRows.filter((r) => r.status === "NO_PRAZO").length,
    lavagem_atrasada: lavRows.filter((r) => (r.atraso_dias ?? 0) > 0).length,
    pneus_total: pneus.count ?? 0,
    sem_estepe: estRows.filter((r) => r.tem_estepe === false).length,
    disp_hoje: dispRow?.disponibilidade ?? null,
    disp_meta: dispRow?.meta ?? null,
    sem_kit_completo: kitRows.filter((r) => !r.triangulo_ok || !r.extintor_ok || !r.macaco_ok || !r.chave_roda_ok).length,
  };
}

export { getManutencaoStatus };
export type { ManutencaoStatusRow };

// Fonte única de vencimento: a tabela `documents` (mesma que alimenta a Central de
// Documentos em /documentos). Antes lia de fact_documentos_frota, uma tabela alimentada
// por importação manual de planilha Excel, totalmente desconectada dos uploads feitos
// pelo usuário — atualizar um documento na Central nunca refletia aqui.
function statusDocumento(vencimento: string | null): { status: string | null; diasPassados: number | null } {
  if (!vencimento) return { status: null, diasPassados: null };
  const dias = Math.round((Date.now() - new Date(`${vencimento}T00:00:00`).getTime()) / 86400000);
  return { status: dias > 0 ? "VENCIDO" : "NO_PRAZO", diasPassados: dias > 0 ? dias : 0 };
}

export async function getDocumentos(tipo?: "DUT" | "CRLV"): Promise<DocumentoRow[]> {
  const { data: docs, error } = await supabaseManutencao
    .from("documents")
    .select("frota,placa,dut_vencimento,crlv_vencimento");
  if (error) throw new Error(`getDocumentos: ${error.message}`);

  const { data: veiculos, error: veiculosError } = await supabaseManutencao
    .from("veiculos")
    .select("codigo_frota,local");
  if (veiculosError) throw new Error(`getDocumentos veiculos: ${veiculosError.message}`);
  const localPorFrota = new Map((veiculos ?? []).map((v) => [v.codigo_frota, v.local]));

  const rows: DocumentoRow[] = [];
  for (const doc of docs ?? []) {
    const localizacao = localPorFrota.get(doc.frota) ?? null;
    if (!tipo || tipo === "DUT") {
      const { status, diasPassados } = statusDocumento(doc.dut_vencimento);
      rows.push({
        equipamento: null,
        placa: doc.placa,
        frota_numero: doc.frota,
        tipo_documento: "DUT",
        data_vencimento: doc.dut_vencimento,
        dias_passados: diasPassados,
        status,
        link_documento: null,
        localizacao,
      });
    }
    if (!tipo || tipo === "CRLV") {
      const { status, diasPassados } = statusDocumento(doc.crlv_vencimento);
      rows.push({
        equipamento: null,
        placa: doc.placa,
        frota_numero: doc.frota,
        tipo_documento: "CRLV",
        data_vencimento: doc.crlv_vencimento,
        dias_passados: diasPassados,
        status,
        link_documento: null,
        localizacao,
      });
    }
  }

  return rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === "VENCIDO" ? -1 : 1;
    return (b.dias_passados ?? 0) - (a.dias_passados ?? 0);
  });
}

export async function getDisponibilidade(dias = 60): Promise<DisponibilidadeRow[]> {
  const { data, error } = await supabaseManutencao
    .from("fact_disponibilidade_diaria")
    .select("data,total,parados,disponibilidade,meta")
    .order("data", { ascending: true })
    .limit(dias);
  if (error) throw new Error(`getDisponibilidade: ${error.message}`);
  return (data ?? []) as DisponibilidadeRow[];
}

export async function getDisponibilidadePorTipo(): Promise<DisponibilidadeTipoRow[]> {
  const { data: latest, error: latestError } = await supabaseManutencao
    .from("fact_disponibilidade_tipo_frota")
    .select("data")
    .order("data", { ascending: false })
    .limit(1);
  if (latestError) throw new Error(`getDisponibilidadePorTipo data: ${latestError.message}`);
  const latestDate = (latest?.[0] as { data: string } | undefined)?.data;
  if (!latestDate) return [];

  const { data, error } = await supabaseManutencao
    .from("fact_disponibilidade_tipo_frota")
    .select("tipo_equipamento,total,parados,disponibilidade")
    .eq("data", latestDate)
    .order("disponibilidade", { ascending: true });
  if (error) throw new Error(`getDisponibilidadePorTipo: ${error.message}`);
  return (data ?? []) as DisponibilidadeTipoRow[];
}

export type PneuVeiculoGroup = {
  equipamento: string | null;
  frota_numero: string | null;
  total_pneus: number;
  marcado: number;
  pneus: PneuRow[];
};

// PostgREST limita a 1000 linhas por request (db.max_rows) independente do .limit() pedido —
// pagina com .range() para trazer a fact_pneus inteira (chega a passar de 1000 linhas com a frota atual).
async function fetchAllPneus(): Promise<PneuRow[]> {
  const rows: PneuRow[] = [];
  const chunkSize = 1000;
  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await supabaseManutencao
      .from("fact_pneus")
      .select("equipamento,frota_numero,posicao,numero_fogo,marca,dt_montagem,status,marcado")
      .order("equipamento")
      .order("posicao")
      .range(from, from + chunkSize - 1);
    if (error) throw new Error(`fetchAllPneus: ${error.message}`);
    const chunk = (data ?? []) as PneuRow[];
    rows.push(...chunk);
    if (chunk.length < chunkSize) break;
  }
  return rows;
}

export async function listVeiculosComPneus(): Promise<PneuVeiculoGroup[]> {
  const rows = await fetchAllPneus();
  const groups = new Map<string, PneuVeiculoGroup>();

  for (const r of rows) {
    const key = r.equipamento ?? r.frota_numero ?? "?";
    const g = groups.get(key) ?? {
      equipamento: r.equipamento,
      frota_numero: r.frota_numero,
      total_pneus: 0,
      marcado: 0,
      pneus: [],
    };
    g.total_pneus++;
    if (r.marcado) g.marcado++;
    g.pneus.push(r);
    groups.set(key, g);
  }

  return [...groups.values()].sort((a, b) => b.total_pneus - a.total_pneus);
}

export async function getPneus(): Promise<PneuRow[]> {
  return fetchAllPneus();
}

export async function getLavagem(): Promise<LavagemRow[]> {
  type VeiculoLavagem = {
    codigo_frota: string;
    placa: string | null;
    equipamento: string | null;
    local: string | null;
    intervalo_lavagem_dias: number | null;
  };
  type ServicoLavagem = {
    id_veiculo: string;
    data_servico: string;
    quilometragem: number | null;
    observacoes: string | null;
  };
  type LavagemLegada = {
    equipamento: string | null;
    placa: string | null;
    frota_numero: string | null;
    setor: string | null;
    data_realizada: string | null;
    intervalo_dias: number | null;
  };

  // PostgREST limita a 1000 linhas por request (db.max_rows) independente do .limit() pedido —
  // pagina com .range() para não cortar histórico conforme os dados crescem.
  async function fetchAllServicosLavagem(): Promise<ServicoLavagem[]> {
    const rows: ServicoLavagem[] = [];
    const chunkSize = 1000;
    for (let from = 0; ; from += chunkSize) {
      const { data, error } = await supabaseManutencao
        .from("servicos_app")
        .select("id_veiculo,data_servico,quilometragem,observacoes")
        .eq("tipo_servico", "lavagem")
        .order("data_servico", { ascending: false })
        .range(from, from + chunkSize - 1);
      if (error) throw new Error(`getLavagem servicos_app: ${error.message}`);
      const chunk = (data ?? []) as ServicoLavagem[];
      rows.push(...chunk);
      if (chunk.length < chunkSize) break;
    }
    return rows;
  }

  async function fetchAllFactLavagem(): Promise<LavagemLegada[]> {
    const rows: LavagemLegada[] = [];
    const chunkSize = 1000;
    for (let from = 0; ; from += chunkSize) {
      const { data, error } = await supabaseManutencao
        .from("fact_lavagem")
        .select("equipamento,placa,frota_numero,setor,data_realizada,intervalo_dias")
        .order("data_realizada", { ascending: false })
        .range(from, from + chunkSize - 1);
      if (error) throw new Error(`getLavagem fact_lavagem: ${error.message}`);
      const chunk = (data ?? []) as LavagemLegada[];
      rows.push(...chunk);
      if (chunk.length < chunkSize) break;
    }
    return rows;
  }

  const [veiculosResult, servicosRows, legadoRows] = await Promise.all([
    supabaseManutencao
      .from("veiculos")
      .select("codigo_frota,placa,equipamento,local,intervalo_lavagem_dias")
      .eq("ativo", true)
      .eq("vendido", false)
      .order("codigo_frota"),
    fetchAllServicosLavagem(),
    fetchAllFactLavagem(),
  ]);

  const error = veiculosResult.error;
  if (error) throw new Error(`getLavagem: ${error.message}`);

  const servicoPorFrota = new Map<string, ServicoLavagem>();
  for (const row of servicosRows) {
    if (!servicoPorFrota.has(row.id_veiculo)) servicoPorFrota.set(row.id_veiculo, row);
  }

  const legadoPorFrota = new Map<string, LavagemLegada>();
  for (const row of legadoRows) {
    for (const key of [row.frota_numero, row.equipamento, row.placa]) {
      if (key && !legadoPorFrota.has(key)) legadoPorFrota.set(key, row);
    }
  }

  const today = reportCalendarDate();
  const rows: LavagemRow[] = ((veiculosResult.data ?? []) as VeiculoLavagem[]).map((veiculo) => {
    const app = servicoPorFrota.get(veiculo.codigo_frota);
    const legacy = legadoPorFrota.get(veiculo.codigo_frota)
      ?? (veiculo.equipamento ? legadoPorFrota.get(veiculo.equipamento) : undefined)
      ?? (veiculo.placa ? legadoPorFrota.get(veiculo.placa) : undefined);
    const appDate = calendarDate(app?.data_servico);
    const legacyDate = calendarDate(legacy?.data_realizada);
    const useApp = Boolean(appDate && (!legacyDate || appDate >= legacyDate));
    const performedDate = useApp ? appDate : legacyDate;
    const interval = veiculo.intervalo_lavagem_dias ?? legacy?.intervalo_dias ?? 30;
    const schedule = calculateDateSchedule(performedDate, interval, today);

    return {
      equipamento: veiculo.equipamento,
      placa: veiculo.placa,
      frota_numero: veiculo.codigo_frota,
      setor: veiculo.local,
      data_realizada: performedDate,
      proxima_data: schedule.nextDate,
      intervalo_dias: interval,
      quilometragem: useApp ? app?.quilometragem ?? null : null,
      observacoes: useApp ? app?.observacoes ?? null : null,
      atraso_dias: schedule.overdueDays,
      status: schedule.status,
    };
  });

  return rows.sort((a, b) => {
    if (!a.data_realizada && b.data_realizada) return -1;
    if (a.data_realizada && !b.data_realizada) return 1;
    return (b.atraso_dias ?? 0) - (a.atraso_dias ?? 0);
  });
}

export async function getKitSeguranca(): Promise<KitSegurancaRow[]> {
  const { data, error } = await supabaseManutencao
    .from("fact_kit_seguranca")
    .select("equipamento,placa,frota_numero,setor,triangulo_ok,extintor_ok,macaco_ok,chave_roda_ok")
    .order("frota_numero")
    .limit(400);
  if (error) throw new Error(`getKitSeguranca: ${error.message}`);
  return (data ?? []) as KitSegurancaRow[];
}

export async function getBateria(): Promise<BateriaRow[]> {
  const { data, error } = await supabaseManutencao
    .from("fact_bateria_garantia")
    .select("equipamento,placa,frota_numero,setor,data_compra,modelo_bateria,loja")
    .order("data_compra", { ascending: true })
    .limit(300);
  if (error) throw new Error(`getBateria: ${error.message}`);
  return (data ?? []) as BateriaRow[];
}

export async function getEstepes(): Promise<EstepeRow[]> {
  const { data, error } = await supabaseManutencao
    .from("fact_estepes")
    .select("frota_numero,placa,modelo,setor,tem_estepe,data_verificacao")
    .order("tem_estepe", { ascending: true })
    .order("placa")
    .limit(200);
  if (error) throw new Error(`getEstepes: ${error.message}`);
  return (data ?? []) as EstepeRow[];
}

export type ParadaRow = {
  id: number | string;
  veiculo_id?: number | null;
  frota_numero: string | null;
  placa: string | null;
  descricao_original: string;
  servicos: string | null;
  classificacao: string | null;
  oficina: string | null;
  proxima_programacao: string | null;
  inicio_em: string | null;
  prev_saida: string | null;
  setor: string | null;
  status: string | null;
  ia_texto_corrigido: string | null;
  ia_classificacao: string | null;
  ia_criticidade: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA" | null;
  ia_acao_recomendada: string | null;
  ia_justificativa: string | null;
  ia_analisado_em: string | null;
};

type VeiculoParadoRow = {
  id: number;
  codigo_frota: string | null;
  placa: string | null;
  local: string | null;
  status: string | null;
  manutencao_motivo: string | null;
  manutencao_tipo: string | null;
  manutencao_oficina: string | null;
  manutencao_destino: string | null;
  manutencao_destino_detalhe: string | null;
  manutencao_iniciado_em: string | null;
  manutencao_prev_retorno: string | null;
};

function paradaKey(frotaNumero: string | null, placa: string | null): string {
  return (frotaNumero || placa || "").trim().toUpperCase();
}

function normalizeIdentificador(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function paradaManual(row: VeiculoParadoRow): ParadaRow {
  const destino = row.manutencao_destino_detalhe ?? row.manutencao_oficina ?? row.manutencao_destino;
  return {
    id: `veiculo-${row.id}`,
    veiculo_id: row.id,
    frota_numero: row.codigo_frota,
    placa: row.placa,
    descricao_original: row.manutencao_motivo ?? "Frota enviada manualmente para manutenção.",
    servicos: row.manutencao_tipo,
    classificacao: row.manutencao_tipo,
    oficina: destino,
    proxima_programacao: null,
    inicio_em: row.manutencao_iniciado_em?.slice(0, 10) ?? null,
    prev_saida: row.manutencao_prev_retorno,
    setor: row.local,
    status: row.status,
    ia_texto_corrigido: null,
    ia_classificacao: row.manutencao_tipo ? `Manutenção ${row.manutencao_tipo.toLowerCase()}` : "Manutenção manual",
    ia_criticidade: "MEDIA",
    ia_acao_recomendada: "Acompanhar retorno da manutenção.",
    ia_justificativa: "Registro manual de frota em manutenção.",
    ia_analisado_em: new Date().toISOString(),
  };
}

// Frotas com status=manutencao AGORA (fonte viva — mesma da aba Veículos filtrada
// por "Em manutenção"). Separado de getParadas() porque fact_frotas_paradas é uma
// planilha importada uma vez e nunca mais atualizada — a maioria das linhas lá
// aponta pra frotas que já voltaram à operação há tempos. O Radar de Preventivas
// usa só esta função pra não misturar frota real com fantasma da planilha.
export async function listFrotasEmManutencaoAgora(): Promise<ParadaRow[]> {
  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select(
      "id,codigo_frota,placa,local,status,manutencao_motivo,manutencao_tipo,manutencao_oficina,manutencao_destino,manutencao_destino_detalhe,manutencao_iniciado_em,manutencao_prev_retorno"
    )
    .eq("status", "manutencao")
    .eq("ativo", true)
    .eq("vendido", false)
    .order("manutencao_iniciado_em", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`listFrotasEmManutencaoAgora: ${error.message}`);
  return ((data ?? []) as VeiculoParadoRow[]).map(paradaManual);
}

export async function getParadas(): Promise<ParadaRow[]> {
  const [importadasResult, manuaisAgora] = await Promise.all([
    supabaseManutencao
      .from("fact_frotas_paradas")
      .select("*")
      .order("ia_criticidade", { nullsFirst: false })
      .order("id"),
    listFrotasEmManutencaoAgora(),
  ]);
  if (importadasResult.error) throw new Error(`getParadas: ${importadasResult.error.message}`);

  const importadas = (importadasResult.data ?? []) as ParadaRow[];
  const existentes = new Set(importadas.map((r) => paradaKey(r.frota_numero, r.placa)).filter(Boolean));
  const manuais = manuaisAgora.filter((r) => !existentes.has(paradaKey(r.frota_numero, r.placa)));

  // Lookup veiculo_id for imported rows via frota_numero/placa. Normaliza (sem
  // traço/espaço) dos dois lados — a planilha importada às vezes guarda a placa
  // sem o traço que o cadastro do veículo tem ("PHM1144" vs "PHM-1144"), e uma
  // comparação exata perdia o match.
  const veiculoMap = new Map<string, number>();
  if (importadas.length > 0) {
    const { data: veiculos, error: veiculosError } = await supabaseManutencao
      .from("veiculos")
      .select("id,codigo_frota,placa")
      .eq("ativo", true)
      .eq("vendido", false);
    if (veiculosError) throw new Error(`getParadas veiculos: ${veiculosError.message}`);
    for (const v of veiculos ?? []) {
      if (v.codigo_frota) veiculoMap.set(normalizeIdentificador(v.codigo_frota), v.id);
      if (v.placa) veiculoMap.set(normalizeIdentificador(v.placa), v.id);
    }
  }

  const importadasComId = importadas.map((r) => ({
    ...r,
    veiculo_id:
      veiculoMap.get(normalizeIdentificador(r.frota_numero)) ??
      veiculoMap.get(normalizeIdentificador(r.placa)) ??
      null,
  }));

  return [...manuais, ...importadasComId];
}
