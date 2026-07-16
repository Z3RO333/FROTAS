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
    supabaseManutencao.from("fact_documentos_frota").select("status,tipo_documento").neq("tipo_documento", "TACOGRAFO"),
    supabaseManutencao.from("fact_manutencao_programada").select("status"),
    supabaseManutencao.from("fact_lavagem").select("atraso_dias"),
    supabaseManutencao.from("fact_pneus").select("id", { count: "exact", head: true }),
    supabaseManutencao.from("fact_estepes").select("tem_estepe"),
    supabaseManutencao.from("fact_kit_seguranca").select("triangulo_ok,extintor_ok,macaco_ok,chave_roda_ok"),
    supabaseManutencao.from("fact_disponibilidade_diaria").select("disponibilidade,meta").order("data", { ascending: false }).limit(1),
  ]);
  const overviewError = docs.error ?? manut.error ?? lavagem.error ?? pneus.error ?? estepes.error ?? kit.error ?? disp.error;
  if (overviewError) throw new Error(`getPlanejamentoOverview: ${overviewError.message}`);

  const docsRows = (docs.data ?? []) as Array<{ status: string | null; tipo_documento: string | null }>;
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
  const { data, error } = await query.limit(500);
  if (error) throw new Error(`getManutencao: ${error.message}`);
  return (data ?? []) as ManutencaoRow[];
}

export async function getDocumentos(tipo?: string): Promise<DocumentoRow[]> {
  let query = supabaseManutencao
    .from("fact_documentos_frota")
    .select("equipamento,placa,frota_numero,tipo_documento,data_vencimento,dias_passados,status,link_documento,localizacao")
    .order("status", { nullsFirst: false })
    .order("dias_passados", { ascending: false });
  if (tipo) {
    query = query.eq("tipo_documento", tipo);
  } else {
    query = query.neq("tipo_documento", "TACOGRAFO");
  }
  const { data, error } = await query.limit(500);
  if (error) throw new Error(`getDocumentos: ${error.message}`);
  return (data ?? []) as DocumentoRow[];
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

export async function listVeiculosComPneus(limit = 50): Promise<PneuVeiculoGroup[]> {
  const { data, error } = await supabaseManutencao
    .from("fact_pneus")
    .select("equipamento,frota_numero,posicao,numero_fogo,marca,dt_montagem,status,marcado")
    .order("equipamento")
    .order("posicao")
    .limit(2000);
  if (error) throw new Error(`listVeiculosComPneus: ${error.message}`);

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
  const { data, error } = await supabaseManutencao
    .from("fact_pneus")
    .select("equipamento,frota_numero,posicao,numero_fogo,marca,dt_montagem,status,marcado")
    .order("equipamento")
    .order("posicao")
    .limit(1000);
  if (error) throw new Error(`getPneus: ${error.message}`);
  return (data ?? []) as PneuRow[];
}

export async function getLavagem(): Promise<LavagemRow[]> {
  const { data, error } = await supabaseManutencao
    .from("fact_lavagem")
    .select("equipamento,placa,frota_numero,setor,data_realizada,atraso_dias,status")
    .order("atraso_dias", { ascending: false })
    .limit(300);
  if (error) throw new Error(`getLavagem: ${error.message}`);
  return (data ?? []) as LavagemRow[];
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

export async function getParadas(): Promise<ParadaRow[]> {
  const [importadasResult, manutencaoResult] = await Promise.all([
    supabaseManutencao
      .from("fact_frotas_paradas")
      .select("*")
      .order("ia_criticidade", { nullsFirst: false })
      .order("id"),
    supabaseManutencao
      .from("veiculos")
      .select(
        "id,codigo_frota,placa,local,status,manutencao_motivo,manutencao_tipo,manutencao_oficina,manutencao_destino,manutencao_destino_detalhe,manutencao_iniciado_em,manutencao_prev_retorno"
      )
      .eq("status", "manutencao")
      .eq("ativo", true)
      .eq("vendido", false)
      .order("manutencao_iniciado_em", { ascending: false, nullsFirst: false }),
  ]);
  const paradasError = importadasResult.error ?? manutencaoResult.error;
  if (paradasError) throw new Error(`getParadas: ${paradasError.message}`);

  const importadas = (importadasResult.data ?? []) as ParadaRow[];
  const existentes = new Set(importadas.map((r) => paradaKey(r.frota_numero, r.placa)).filter(Boolean));
  const manuais = ((manutencaoResult.data ?? []) as VeiculoParadoRow[])
    .filter((r) => !existentes.has(paradaKey(r.codigo_frota, r.placa)))
    .map(paradaManual);

  // Lookup veiculo_id for imported rows via frota_numero/placa
  const frotaNums = importadas.map((r) => r.frota_numero).filter(Boolean) as string[];
  const placas = importadas.map((r) => r.placa).filter(Boolean) as string[];
  const veiculoMap = new Map<string, number>();
  if (frotaNums.length > 0 || placas.length > 0) {
    const { data: veiculos, error: veiculosError } = await supabaseManutencao
      .from("veiculos")
      .select("id,codigo_frota,placa")
      .or(
        [
          frotaNums.length > 0 ? `codigo_frota.in.(${frotaNums.map((f) => `"${f}"`).join(",")})` : null,
          placas.length > 0 ? `placa.in.(${placas.map((p) => `"${p}"`).join(",")})` : null,
        ]
          .filter(Boolean)
          .join(",")
      );
    if (veiculosError) throw new Error(`getParadas veiculos: ${veiculosError.message}`);
    for (const v of veiculos ?? []) {
      if (v.codigo_frota) veiculoMap.set(v.codigo_frota.trim().toUpperCase(), v.id);
      if (v.placa) veiculoMap.set(v.placa.trim().toUpperCase(), v.id);
    }
  }

  const importadasComId = importadas.map((r) => ({
    ...r,
    veiculo_id:
      (r.frota_numero && veiculoMap.get(r.frota_numero.trim().toUpperCase())) ||
      (r.placa && veiculoMap.get(r.placa.trim().toUpperCase())) ||
      null,
  }));

  return [...manuais, ...importadasComId];
}
