import { execute, query, SCHEMA_FQN } from "@/lib/db";

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

async function safeQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await query<T>(sql, params);
  } catch (error) {
    console.warn("[historico] consulta indisponivel", error);
    return [];
  }
}

export async function listHistorico(frotaId: number): Promise<HistoricoEntry[]> {
  return safeQuery<HistoricoEntry>(
    `SELECT * FROM ${SCHEMA_FQN}.frotas_historico WHERE frota_id = ? ORDER BY alterado_em DESC LIMIT 200`,
    [frotaId]
  );
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
    safeQuery<{
      id: number;
      frota_id: number;
      km_anterior: number | null;
      km_novo: number | null;
      diferenca_km: number | null;
      origem: string | null;
      motorista_id: string | null;
      motorista_nome: string | null;
      validado: boolean | null;
      validado_por: string | null;
      criado_em: string | null;
    }>(
      `SELECT *
       FROM ${SCHEMA_FQN}.historico_km_frota
       WHERE frota_id = ?
       ORDER BY criado_em DESC, id DESC
       LIMIT 100`,
      [frotaId]
    ),
    safeQuery<{
      id: number;
      frota_id: number;
      motorista_id: string | null;
      motorista_nome: string | null;
      data_checklist: string | null;
      km_informado: number | null;
      status_geral: string | null;
      observacao_corrigida_ia: string | null;
      observacao_original: string | null;
    }>(
      `SELECT *
       FROM ${SCHEMA_FQN}.checklists_frota
       WHERE frota_id = ?
       ORDER BY data_checklist DESC, id DESC
       LIMIT 100`,
      [frotaId]
    ),
    safeQuery<{
      id: number;
      frota_id: number;
      motorista_id: string | null;
      motorista_nome: string | null;
      data_hora: string | null;
      tipo_combustivel: string | null;
      litros_combustivel: number | null;
      litros_arla: number | null;
      km_no_abastecimento: number | null;
      origem: string | null;
    }>(
      `SELECT *
       FROM ${SCHEMA_FQN}.abastecimentos_frota
       WHERE frota_id = ?
       ORDER BY data_hora DESC, id DESC
       LIMIT 100`,
      [frotaId]
    ),
    safeQuery<{
      id: number;
      frota_id: number;
      motorista_id: string | null;
      checklist_id: number | null;
      tipo_movimentacao: string | null;
      data_hora: string | null;
      usuario_portaria_id: string | null;
      observacao: string | null;
    }>(
      `SELECT *
       FROM ${SCHEMA_FQN}.movimentacoes_frota
       WHERE frota_id = ?
       ORDER BY data_hora DESC, id DESC
       LIMIT 100`,
      [frotaId]
    ),
    safeQuery<{
      id: number;
      frota_id: number;
      checklist_id: number | null;
      item_nome: string | null;
      gravidade: string | null;
      status: string | null;
      responsavel_id: string | null;
      criado_em: string | null;
      resolvido_em: string | null;
    }>(
      `SELECT *
       FROM ${SCHEMA_FQN}.pendencias_frota
       WHERE frota_id = ?
       ORDER BY criado_em DESC, id DESC
       LIMIT 100`,
      [frotaId]
    ),
  ]);

  const entries: HistoricoEntry[] = [
    ...alteracoes.map((item) => ({
      ...item,
      tipo: "ALTERACAO",
      titulo: `Cadastro: ${labelCampo(item.campo)}`,
      descricao: null,
    })),
    ...kms.map((item) => ({
      id: item.id,
      frota_id: item.frota_id,
      tipo: "KM",
      titulo: "Quilometragem registrada",
      campo: "km",
      valor_antigo: item.km_anterior != null ? String(item.km_anterior) : null,
      valor_novo: item.km_novo != null ? String(item.km_novo) : null,
      descricao: [
        item.diferenca_km != null ? `Diferença: ${item.diferenca_km} km` : null,
        item.validado === false ? "Pendente de validação" : "Validado",
      ].filter(Boolean).join(" · "),
      alterado_em: item.criado_em ?? "",
      alterado_por: item.validado_por ?? item.motorista_id ?? item.origem ?? "-",
      status: item.validado === false ? "PENDENTE" : "VALIDADO",
      motorista_id: item.motorista_id,
      motorista_nome: item.motorista_nome,
      origem: item.origem,
    })),
    ...checklists.map((item) => ({
      id: item.id,
      frota_id: item.frota_id,
      tipo: "CHECKLIST",
      titulo: "Checklist de frota",
      campo: "checklist",
      valor_antigo: null,
      valor_novo: item.status_geral,
      descricao: [
        item.km_informado != null ? `KM informado: ${item.km_informado}` : null,
        item.observacao_corrigida_ia ?? item.observacao_original,
      ].filter(Boolean).join(" · "),
      alterado_em: item.data_checklist ?? "",
      alterado_por: item.motorista_nome ?? item.motorista_id ?? "-",
      status: item.status_geral,
      motorista_id: item.motorista_id,
      motorista_nome: item.motorista_nome,
    })),
    ...abastecimentos.map((item) => ({
      id: item.id,
      frota_id: item.frota_id,
      tipo: "ABASTECIMENTO",
      titulo: "Abastecimento",
      campo: "abastecimento",
      valor_antigo: null,
      valor_novo: [
        item.litros_combustivel != null ? `${item.litros_combustivel} L combustível` : null,
        item.litros_arla != null ? `${item.litros_arla} L Arla` : null,
      ].filter(Boolean).join(" / ") || null,
      descricao: [
        item.tipo_combustivel,
        item.km_no_abastecimento != null ? `KM: ${item.km_no_abastecimento}` : null,
      ].filter(Boolean).join(" · "),
      alterado_em: item.data_hora ?? "",
      alterado_por: item.motorista_nome ?? item.motorista_id ?? item.origem ?? "-",
      motorista_id: item.motorista_id,
      motorista_nome: item.motorista_nome,
      origem: item.origem,
    })),
    ...movimentacoes.map((item) => ({
      id: item.id,
      frota_id: item.frota_id,
      tipo: "PORTARIA",
      titulo: item.tipo_movimentacao === "ENTRADA" ? "Entrada registrada" : "Saída registrada",
      campo: "movimentacao",
      valor_antigo: null,
      valor_novo: item.tipo_movimentacao,
      descricao: item.observacao,
      alterado_em: item.data_hora ?? "",
      alterado_por: item.usuario_portaria_id ?? "-",
      motorista_id: item.motorista_id,
      status: item.tipo_movimentacao,
    })),
    ...pendencias.map((item) => ({
      id: item.id,
      frota_id: item.frota_id,
      tipo: "PENDENCIA",
      titulo: "Pendência de frota",
      campo: "pendencia",
      valor_antigo: item.gravidade,
      valor_novo: item.status,
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
  await execute(
    `INSERT INTO ${SCHEMA_FQN}.frotas_historico
      (frota_id, campo, valor_antigo, valor_novo, alterado_em, alterado_por)
     VALUES (?, ?, ?, ?, current_timestamp(), ?)`,
    [frotaId, campo, valorAntigo, valorNovo, userEmail]
  );
}

export async function listHistoricoKm(
  frotaId: number
): Promise<{ alterado_em: string; valor_novo: string }[]> {
  return safeQuery(
    `SELECT criado_em AS alterado_em, CAST(km_novo AS STRING) AS valor_novo
     FROM ${SCHEMA_FQN}.historico_km_frota
     WHERE frota_id = ?
     UNION ALL
     SELECT alterado_em, valor_novo
     FROM ${SCHEMA_FQN}.frotas_historico
     WHERE frota_id = ? AND campo = 'km'
     ORDER BY alterado_em ASC`,
    [frotaId, frotaId]
  );
}

function labelCampo(campo: string): string {
  const labels: Record<string, string> = {
    km: "KM",
    km_atual: "KM",
    status: "Status",
    chassi: "Chassi",
    observacoes: "Observações",
    localizacao: "Localização",
  };
  return labels[campo] ?? campo;
}
