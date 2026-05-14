import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type PlanejamentoOverview = {
  docs_vencidos: number;
  docs_preventiva: number;
  manut_atrasadas: number;
  manut_ok: number;
  lavagem_atrasada: number;
  pneus_total: number;
  sem_estepe: number;
  disp_hoje: number | null;
  disp_meta: number | null;
  sem_kit_completo: number;
};

export type ManutencaoRow = {
  equipamento: string | null;
  placa: string | null;
  frota_numero: string | null;
  setor: string | null;
  tipo_servico: string;
  data_realizada: string | null;
  media_intervalo: number | null;
  desvio: number | null;
  status: string | null;
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

export async function getPlanejamentoOverview(): Promise<PlanejamentoOverview> {
  const [docs, manut, lavagem, pneus, estepes, kit, disp] = await Promise.all([
    supabaseManutencao.from("fact_documentos_frota").select("status"),
    supabaseManutencao.from("fact_manutencao_programada").select("status"),
    supabaseManutencao.from("fact_lavagem").select("atraso_dias"),
    supabaseManutencao.from("fact_pneus").select("id", { count: "exact", head: true }),
    supabaseManutencao.from("fact_estepes").select("tem_estepe"),
    supabaseManutencao.from("fact_kit_seguranca").select("triangulo_ok,extintor_ok,macaco_ok,chave_roda_ok"),
    supabaseManutencao.from("fact_disponibilidade_diaria").select("disponibilidade,meta").order("data", { ascending: false }).limit(1),
  ]);

  const docsRows = (docs.data ?? []) as Array<{ status: string | null }>;
  const manutRows = (manut.data ?? []) as Array<{ status: string | null }>;
  const lavRows = (lavagem.data ?? []) as Array<{ atraso_dias: number | null }>;
  const estRows = (estepes.data ?? []) as Array<{ tem_estepe: boolean | null }>;
  const kitRows = (kit.data ?? []) as Array<{ triangulo_ok: boolean | null; extintor_ok: boolean | null; macaco_ok: boolean | null; chave_roda_ok: boolean | null }>;
  const dispRow = (disp.data ?? [])[0] as { disponibilidade: number | null; meta: number | null } | undefined;

  return {
    docs_vencidos: docsRows.filter((r) => r.status === "VENCIDO").length,
    docs_preventiva: docsRows.filter((r) => r.status && r.status !== "VENCIDO" && r.status !== "NO_PRAZO").length,
    manut_atrasadas: manutRows.filter((r) => r.status !== "NO_PRAZO" && r.status !== null).length,
    manut_ok: manutRows.filter((r) => r.status === "NO_PRAZO").length,
    lavagem_atrasada: lavRows.filter((r) => (r.atraso_dias ?? 0) > 0).length,
    pneus_total: pneus.count ?? 0,
    sem_estepe: estRows.filter((r) => r.tem_estepe === false).length,
    disp_hoje: dispRow?.disponibilidade ?? null,
    disp_meta: dispRow?.meta ?? null,
    sem_kit_completo: kitRows.filter((r) => !r.triangulo_ok || !r.extintor_ok || !r.macaco_ok || !r.chave_roda_ok).length,
  };
}

export async function getManutencao(tipoServico?: string): Promise<ManutencaoRow[]> {
  let query = supabaseManutencao
    .from("fact_manutencao_programada")
    .select("equipamento,placa,frota_numero,setor,tipo_servico,data_realizada,media_intervalo,desvio,status")
    .order("tipo_servico")
    .order("status", { nullsFirst: false });
  if (tipoServico) query = query.eq("tipo_servico", tipoServico);
  const { data } = await query.limit(500);
  return (data ?? []) as ManutencaoRow[];
}

export async function getDocumentos(tipo?: string): Promise<DocumentoRow[]> {
  let query = supabaseManutencao
    .from("fact_documentos_frota")
    .select("equipamento,placa,frota_numero,tipo_documento,data_vencimento,dias_passados,status,link_documento,localizacao")
    .order("status", { nullsFirst: false })
    .order("dias_passados", { ascending: false });
  if (tipo) query = query.eq("tipo_documento", tipo);
  const { data } = await query.limit(500);
  return (data ?? []) as DocumentoRow[];
}

export async function getDisponibilidade(dias = 60): Promise<DisponibilidadeRow[]> {
  const { data } = await supabaseManutencao
    .from("fact_disponibilidade_diaria")
    .select("data,total,parados,disponibilidade,meta")
    .order("data", { ascending: true })
    .limit(dias);
  return (data ?? []) as DisponibilidadeRow[];
}

export async function getDisponibilidadePorTipo(): Promise<DisponibilidadeTipoRow[]> {
  const { data: latest } = await supabaseManutencao
    .from("fact_disponibilidade_tipo_frota")
    .select("data")
    .order("data", { ascending: false })
    .limit(1);
  const latestDate = (latest?.[0] as { data: string } | undefined)?.data;
  if (!latestDate) return [];

  const { data } = await supabaseManutencao
    .from("fact_disponibilidade_tipo_frota")
    .select("tipo_equipamento,total,parados,disponibilidade")
    .eq("data", latestDate)
    .order("disponibilidade", { ascending: true });
  return (data ?? []) as DisponibilidadeTipoRow[];
}

export type PneuVeiculoGroup = {
  equipamento: string | null;
  frota_numero: string | null;
  total_pneus: number;
  marcado: number;
  pneus: PneuRow[];
};

export async function listVeiculosComPneus(limit = 50): Promise<PneuVeiculoGroup[]> {
  const { data } = await supabaseManutencao
    .from("fact_pneus")
    .select("equipamento,frota_numero,posicao,numero_fogo,marca,dt_montagem,status,marcado")
    .order("equipamento")
    .order("posicao")
    .limit(2000);

  const rows = (data ?? []) as PneuRow[];
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

  return [...groups.values()]
    .sort((a, b) => b.total_pneus - a.total_pneus)
    .slice(0, limit);
}

export async function getPneus(): Promise<PneuRow[]> {
  const { data } = await supabaseManutencao
    .from("fact_pneus")
    .select("equipamento,frota_numero,posicao,numero_fogo,marca,dt_montagem,status,marcado")
    .order("equipamento")
    .order("posicao")
    .limit(1000);
  return (data ?? []) as PneuRow[];
}

export async function getLavagem(): Promise<LavagemRow[]> {
  const { data } = await supabaseManutencao
    .from("fact_lavagem")
    .select("equipamento,placa,frota_numero,setor,data_realizada,atraso_dias,status")
    .order("atraso_dias", { ascending: false })
    .limit(300);
  return (data ?? []) as LavagemRow[];
}

export async function getKitSeguranca(): Promise<KitSegurancaRow[]> {
  const { data } = await supabaseManutencao
    .from("fact_kit_seguranca")
    .select("equipamento,placa,frota_numero,setor,triangulo_ok,extintor_ok,macaco_ok,chave_roda_ok")
    .order("frota_numero")
    .limit(400);
  return (data ?? []) as KitSegurancaRow[];
}

export async function getBateria(): Promise<BateriaRow[]> {
  const { data } = await supabaseManutencao
    .from("fact_bateria_garantia")
    .select("equipamento,placa,frota_numero,setor,data_compra,modelo_bateria,loja")
    .order("data_compra", { ascending: true })
    .limit(300);
  return (data ?? []) as BateriaRow[];
}

export async function getEstepes(): Promise<EstepeRow[]> {
  const { data } = await supabaseManutencao
    .from("fact_estepes")
    .select("frota_numero,placa,modelo,setor,tem_estepe,data_verificacao")
    .order("tem_estepe", { ascending: true })
    .order("placa")
    .limit(200);
  return (data ?? []) as EstepeRow[];
}

export type ParadaRow = {
  id: number;
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

export async function getParadas(): Promise<ParadaRow[]> {
  const { data } = await supabaseManutencao
    .from("fact_frotas_paradas")
    .select("*")
    .order("ia_criticidade", { nullsFirst: false })
    .order("id");
  return (data ?? []) as ParadaRow[];
}
