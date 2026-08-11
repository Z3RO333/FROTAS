import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type HistoricoEntry = {
  id: number;
  frota_id: number;
  tipo?: string;
  titulo?: string;
  descricao?: string | null;
  campo: string;
  valor_antigo: string | null;
  valor_novo: string | null;
  alterado_em: string;
  alterado_por: string;
  status?: string | null;
  motorista_nome?: string | null;
  motorista_id?: string | null;
  origem?: string | null;
};

type HistorySourceRow = {
  id: number | string;
  frota_id: number | string;
  km_anterior?: number | null;
  km_novo?: number | null;
  diferenca_km?: number | null;
  validado?: boolean | null;
  validado_por?: string | null;
  motorista_id?: string | null;
  motorista_nome?: string | null;
  origem?: string | null;
  criado_em?: string | null;
  data_checklist?: string | null;
  status_geral?: string | null;
  km_informado?: number | null;
  observacao_corrigida_ia?: string | null;
  observacao_original?: string | null;
  litros_combustivel?: number | null;
  litros_arla?: number | null;
  tipo_combustivel?: string | null;
  km_no_abastecimento?: number | null;
  data_hora?: string | null;
  tipo_movimentacao?: string | null;
  observacao?: string | null;
  usuario_portaria_id?: string | null;
  gravidade?: string | null;
  status?: string | null;
  item_nome?: string | null;
  responsavel_id?: string | null;
};

async function safeSupabase<T>(label: string, cb: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await cb();
  } catch (error) {
    void fallback;
    throw new Error(`[historico] ${label} indisponível`, { cause: error });
  }
}

export async function listHistorico(frotaId: number): Promise<HistoricoEntry[]> {
  return safeSupabase("alteracoes", async () => {
    const { data, error } = await supabaseManutencao
      .from("frotas_historico")
      .select("*")
      .eq("frota_id", frotaId)
      .order("alterado_em", { ascending: false })
      .limit(200);

    if (error) throw error;
    return (data ?? []) as HistoricoEntry[];
  }, []);
}

export async function listHistoricoCompleto(frotaId: number): Promise<HistoricoEntry[]> {
  const [
    alteracoes,
    kms,
    checklists,
    abastecimentos,
    movimentacoes,
    pendencias,
  ] = await Promise.all([
    listHistorico(frotaId),
    safeSupabase("kms", async () => {
      const { data, error } = await supabaseManutencao
        .from("historico_km_frota")
        .select("*")
        .eq("frota_id", frotaId)
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as HistorySourceRow[];
    }, []),
    safeSupabase("checklists", async () => {
      const { data, error } = await supabaseManutencao
        .from("checklists_frota")
        .select("*")
        .eq("frota_id", frotaId)
        .order("data_checklist", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as HistorySourceRow[];
    }, []),
    safeSupabase("abastecimentos", async () => {
      const { data, error } = await supabaseManutencao
        .from("abastecimentos_frota")
        .select("*")
        .eq("frota_id", frotaId)
        .order("data_hora", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as HistorySourceRow[];
    }, []),
    safeSupabase("movimentacoes", async () => {
      const { data, error } = await supabaseManutencao
        .from("movimentacoes_frota")
        .select("*")
        .eq("frota_id", frotaId)
        .order("data_hora", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as HistorySourceRow[];
    }, []),
    safeSupabase("pendencias", async () => {
      const { data, error } = await supabaseManutencao
        .from("pendencias_frota")
        .select("*")
        .eq("frota_id", frotaId)
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as HistorySourceRow[];
    }, []),
  ]);

  const entries: HistoricoEntry[] = [
    ...alteracoes.map((item) => ({
      ...item,
      tipo: "ALTERACAO",
      titulo: `Cadastro: ${labelCampo(item.campo)}`,
      descricao: null,
    })),
    ...kms.map((item) => ({
      id: Number(item.id),
      frota_id: Number(item.frota_id),
      tipo: "KM",
      titulo: "Quilometragem registrada",
      campo: "km",
      valor_antigo: item.km_anterior != null ? String(item.km_anterior) : null,
      valor_novo: item.km_novo != null ? String(item.km_novo) : null,
      descricao: [
        item.diferenca_km != null ? `Diferenca: ${item.diferenca_km} km` : null,
        item.validado === false ? "Pendente de validacao" : "Validado",
      ].filter(Boolean).join(" - "),
      alterado_em: item.criado_em ?? "",
      alterado_por: item.validado_por ?? item.motorista_id ?? item.origem ?? "-",
      status: item.validado === false ? "PENDENTE" : "VALIDADO",
      motorista_id: item.motorista_id,
      motorista_nome: item.motorista_nome,
      origem: item.origem,
    })),
    ...checklists.map((item) => ({
      id: Number(item.id),
      frota_id: Number(item.frota_id),
      tipo: "CHECKLIST",
      titulo: "Checklist de frota",
      campo: "checklist",
      valor_antigo: null,
      valor_novo: item.status_geral ?? null,
      descricao: [
        item.km_informado != null ? `KM informado: ${item.km_informado}` : null,
        item.observacao_corrigida_ia ?? item.observacao_original,
      ].filter(Boolean).join(" - "),
      alterado_em: item.data_checklist ?? "",
      alterado_por: item.motorista_nome ?? item.motorista_id ?? "-",
      status: item.status_geral,
      motorista_id: item.motorista_id,
      motorista_nome: item.motorista_nome,
    })),
    ...abastecimentos.map((item) => ({
      id: Number(item.id),
      frota_id: Number(item.frota_id),
      tipo: "ABASTECIMENTO",
      titulo: "Abastecimento",
      campo: "abastecimento",
      valor_antigo: null,
      valor_novo: [
        item.litros_combustivel != null ? `${item.litros_combustivel} L combustivel` : null,
        item.litros_arla != null ? `${item.litros_arla} L Arla` : null,
      ].filter(Boolean).join(" / ") || null,
      descricao: [
        item.tipo_combustivel,
        item.km_no_abastecimento != null ? `KM: ${item.km_no_abastecimento}` : null,
      ].filter(Boolean).join(" - "),
      alterado_em: item.data_hora ?? "",
      alterado_por: item.motorista_nome ?? item.motorista_id ?? item.origem ?? "-",
      motorista_id: item.motorista_id,
      motorista_nome: item.motorista_nome,
      origem: item.origem,
    })),
    ...movimentacoes.map((item) => ({
      id: Number(item.id),
      frota_id: Number(item.frota_id),
      tipo: "PORTARIA",
      titulo: item.tipo_movimentacao === "ENTRADA" ? "Entrada registrada" : "Saida registrada",
      campo: "movimentacao",
      valor_antigo: null,
      valor_novo: item.tipo_movimentacao ?? null,
      descricao: item.observacao,
      alterado_em: item.data_hora ?? "",
      alterado_por: item.usuario_portaria_id ?? "-",
      motorista_id: item.motorista_id,
      status: item.tipo_movimentacao,
    })),
    ...pendencias.map((item) => ({
      id: Number(item.id),
      frota_id: Number(item.frota_id),
      tipo: "PENDENCIA",
      titulo: "Pendencia de frota",
      campo: "pendencia",
      valor_antigo: item.gravidade ?? null,
      valor_novo: item.status ?? null,
      descricao: item.item_nome,
      alterado_em: item.criado_em ?? "",
      alterado_por: item.responsavel_id ?? "sistema",
      status: item.status,
    })),
  ];

  return entries
    .filter((entry) => entry.alterado_em)
    .sort((a, b) => new Date(b.alterado_em).getTime() - new Date(a.alterado_em).getTime())
    .slice(0, 200);
}

export async function appendHistorico(
  frotaId: number,
  campo: string,
  valorAntigo: string | null,
  valorNovo: string | null,
  userEmail: string
) {
  const { error } = await supabaseManutencao
    .from("frotas_historico")
    .insert({
      frota_id: frotaId,
      campo,
      valor_antigo: valorAntigo,
      valor_novo: valorNovo,
      alterado_por: userEmail,
    });

  if (error) throw error;
}

export async function listHistoricoKm(
  frotaId: number
): Promise<{ alterado_em: string; valor_novo: string }[]> {
  return safeSupabase("historico de km", async () => {
    const [kmResult, alteracoesResult] = await Promise.all([
      supabaseManutencao
        .from("historico_km_frota")
        .select("criado_em,km_novo")
        .eq("frota_id", frotaId),
      supabaseManutencao
        .from("frotas_historico")
        .select("alterado_em,valor_novo")
        .eq("frota_id", frotaId)
        .eq("campo", "km"),
    ]);

    if (kmResult.error) throw kmResult.error;
    if (alteracoesResult.error) throw alteracoesResult.error;

    return [
      ...(kmResult.data ?? []).map((row) => ({
        alterado_em: row.criado_em ?? "",
        valor_novo: row.km_novo != null ? String(row.km_novo) : "",
      })),
      ...(alteracoesResult.data ?? []).map((row) => ({
        alterado_em: row.alterado_em ?? "",
        valor_novo: row.valor_novo ?? "",
      })),
    ]
      .filter((row) => row.alterado_em && row.valor_novo)
      .sort((a, b) => new Date(a.alterado_em).getTime() - new Date(b.alterado_em).getTime());
  }, []);
}

function labelCampo(campo: string): string {
  const labels: Record<string, string> = {
    km: "KM",
    km_atual: "KM",
    status: "Status",
    chassi: "Chassi",
    observacoes: "Observacoes",
    localizacao: "Localizacao",
    setor: "Setor",
  };
  return labels[campo] ?? campo;
}
