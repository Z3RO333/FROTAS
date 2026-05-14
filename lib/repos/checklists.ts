import { CHECKLIST_ITEMS, type ChecklistStatusGeral, type ChecklistStatusItem } from "@/lib/checklists/catalog";
import { gravidadePendencia, KM_VARIACAO_INCOMUM } from "@/lib/checklists/rules";
import { query, SCHEMA_FQN } from "@/lib/db";
import { createAbastecimento } from "@/lib/repos/abastecimentos";
import { aplicarResumoAbastecimento, aplicarResumoChecklist, getFrota } from "@/lib/repos/frotas";
import {
  appendKmHistory,
  countPendingKmValidations,
  type KmOrigem,
} from "@/lib/repos/historico-km";

const CHECKLISTS_T = `${SCHEMA_FQN}.checklists_frota`;
const ITENS_T = `${SCHEMA_FQN}.checklist_itens`;
const PENDENCIAS_T = `${SCHEMA_FQN}.pendencias_frota`;
const FROTAS_T = `${SCHEMA_FQN}.frotas`;
const MOVIMENTACOES_T = `${SCHEMA_FQN}.movimentacoes_frota`;

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

async function safeQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await query<T>(sql, params);
  } catch (error) {
    console.warn("[checklists] consulta indisponivel", error);
    return [];
  }
}

export async function listDriverChecklists(email: string, limit = 20): Promise<ChecklistListRow[]> {
  return safeQuery<ChecklistListRow>(
    `SELECT c.*, f.frota_geral, f.placa, f.modelo
     FROM ${CHECKLISTS_T} c
     LEFT JOIN ${FROTAS_T} f ON f.id = c.frota_id
     WHERE c.motorista_id = ?
     ORDER BY c.criado_em DESC
     LIMIT ${limit}`,
    [email]
  );
}

export async function listAdminChecklists(limit = 100): Promise<ChecklistListRow[]> {
  return safeQuery<ChecklistListRow>(
    `SELECT c.*, f.frota_geral, f.placa, f.modelo
     FROM ${CHECKLISTS_T} c
     LEFT JOIN ${FROTAS_T} f ON f.id = c.frota_id
     ORDER BY c.criado_em DESC
     LIMIT ${limit}`
  );
}

export async function listChecklistItems(checklistId: number): Promise<ChecklistItemRow[]> {
  return safeQuery<ChecklistItemRow>(
    `SELECT *
     FROM ${ITENS_T}
     WHERE checklist_id = ?
     ORDER BY id`,
    [checklistId]
  );
}

export async function listOpenPendencias(limit = 100): Promise<PendenciaRow[]> {
  return safeQuery<PendenciaRow>(
    `SELECT p.*, f.frota_geral, f.placa, c.motorista_id, c.motorista_nome
     FROM ${PENDENCIAS_T} p
     LEFT JOIN ${FROTAS_T} f ON f.id = p.frota_id
     LEFT JOIN ${CHECKLISTS_T} c ON c.id = p.checklist_id
     WHERE p.status IN ('ABERTA', 'EM_TRATATIVA')
     ORDER BY p.criado_em DESC
     LIMIT ${limit}`
  );
}

export async function checklistDashboardKpis(): Promise<{
  total_hoje: number;
  aprovados_hoje: number;
  pendentes_hoje: number;
  criticos_abertos: number;
  divergencias_km: number;
}> {
  const [checklists, pendencias, divergencias] = await Promise.all([
    safeQuery<{
      total_hoje: number | null;
      aprovados_hoje: number | null;
      pendentes_hoje: number | null;
    }>(
      `SELECT
        COUNT(*) AS total_hoje,
        SUM(CASE WHEN status_geral = 'APROVADO' THEN 1 ELSE 0 END) AS aprovados_hoje,
        SUM(CASE WHEN status_geral IN ('COM_OBSERVACAO', 'NAO_APTO', 'CRITICO') THEN 1 ELSE 0 END) AS pendentes_hoje
       FROM ${CHECKLISTS_T}
       WHERE CAST(data_checklist AS DATE) = current_date()`
    ),
    safeQuery<{ total: number | null }>(
      `SELECT COUNT(*) AS total
       FROM ${PENDENCIAS_T}
       WHERE gravidade = 'CRITICA' AND status IN ('ABERTA', 'EM_TRATATIVA')`
    ),
    countPendingKmValidations().catch(() => 0),
  ]);

  return {
    total_hoje: Number(checklists[0]?.total_hoje ?? 0),
    aprovados_hoje: Number(checklists[0]?.aprovados_hoje ?? 0),
    pendentes_hoje: Number(checklists[0]?.pendentes_hoje ?? 0),
    divergencias_km: Number(divergencias ?? 0),
    criticos_abertos: Number(pendencias[0]?.total ?? 0),
  };
}

export async function listPortariaToday(): Promise<PortariaRow[]> {
  const rows = await safeQuery<Omit<PortariaRow, "status_portaria">>(
    `WITH latest_checklist AS (
       SELECT *
       FROM (
         SELECT
           c.*,
           ROW_NUMBER() OVER (PARTITION BY c.frota_id ORDER BY c.data_checklist DESC, c.id DESC) AS rn
         FROM ${CHECKLISTS_T} c
         WHERE CAST(c.data_checklist AS DATE) = current_date()
       ) ranked
       WHERE rn = 1
     ),
     pendencias_criticas AS (
       SELECT checklist_id, MIN(item_nome) AS pendencia_critica_item
       FROM ${PENDENCIAS_T}
       WHERE gravidade = 'CRITICA' AND status IN ('ABERTA', 'EM_TRATATIVA')
       GROUP BY checklist_id
     ),
     latest_movimentacao AS (
       SELECT *
       FROM (
         SELECT
           m.*,
           ROW_NUMBER() OVER (PARTITION BY m.frota_id ORDER BY m.data_hora DESC, m.id DESC) AS rn
         FROM ${MOVIMENTACOES_T} m
         WHERE CAST(m.data_hora AS DATE) = current_date()
       ) ranked
       WHERE rn = 1
     )
     SELECT
       f.id AS frota_id,
       f.frota_geral,
       f.placa,
       f.modelo,
       f.status AS status_frota,
       c.id AS checklist_id,
       c.motorista_id,
       c.motorista_nome,
       c.data_checklist,
       c.km_informado,
       c.status_geral,
       p.pendencia_critica_item,
       m.tipo_movimentacao AS ultimo_tipo_movimentacao,
       m.data_hora AS ultimo_movimento_em
     FROM ${FROTAS_T} f
     LEFT JOIN latest_checklist c ON c.frota_id = f.id
     LEFT JOIN pendencias_criticas p ON p.checklist_id = c.id
     LEFT JOIN latest_movimentacao m ON m.frota_id = f.id
     WHERE f.ativo = TRUE AND f.vendido = FALSE
     ORDER BY
       CASE WHEN c.id IS NULL THEN 1 ELSE 0 END,
       c.data_checklist DESC,
       f.frota_geral`
  );

  return rows.map((row) => ({
    ...row,
    status_portaria: statusPortariaFromRow(row),
  }));
}

export async function registrarMovimentacaoFrota(input: RegistrarMovimentacaoInput): Promise<void> {
  await query(
    `INSERT INTO ${MOVIMENTACOES_T}
      (frota_id, motorista_id, checklist_id, tipo_movimentacao, data_hora, usuario_portaria_id, observacao, criado_em)
     VALUES (?, ?, ?, ?, current_timestamp(), ?, ?, current_timestamp())`,
    [
      input.frota_id,
      input.motorista_id,
      input.checklist_id,
      input.tipo_movimentacao,
      input.usuario_portaria_id,
      input.observacao ?? null,
    ]
  );
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
  // Primeiro KM, KM menor que o anterior ou variação incomum exigem validação do admin.
  const kmAutoValidado = !isPrimeiroKm && !variacaoIncomum && !kmMenor;

  await query(
    `INSERT INTO ${CHECKLISTS_T}
      (frota_id, motorista_id, motorista_nome, data_checklist, km_informado, km_lido_ocr, ocr_confianca, km_confirmado, foto_km_url, status_geral, observacao_original, observacao_corrigida_ia, criado_em)
     VALUES (?, ?, ?, current_timestamp(), ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp())`,
    [
      input.frota_id,
      input.motorista_id,
      input.motorista_nome,
      input.km_informado,
      input.km_lido_ocr ?? null,
      input.ocr_confianca ?? null,
      input.km_confirmado,
      input.foto_km_url ?? null,
      input.status_geral,
      input.observacao_original ?? null,
      input.observacao_corrigida_ia ?? null,
    ]
  );

  const created = await query<{ id: number }>(
    `SELECT id
     FROM ${CHECKLISTS_T}
     WHERE frota_id = ? AND motorista_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [input.frota_id, input.motorista_id]
  );
  const checklistId = Number(created[0]?.id);
  if (!checklistId) throw new Error("Checklist nao foi criado");

  for (const itemInput of input.itens) {
    const catalogItem = CHECKLIST_ITEMS.find((item) => item.codigo === itemInput.item_codigo);
    if (!catalogItem) continue;

    await query(
      `INSERT INTO ${ITENS_T}
        (checklist_id, item_codigo, item_nome, grupo, status, obrigatorio, critico, observacao, foto_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        checklistId,
        catalogItem.codigo,
        catalogItem.nome,
        catalogItem.grupo,
        itemInput.status,
        catalogItem.obrigatorio,
        catalogItem.critico,
        itemInput.observacao ?? null,
        itemInput.foto_url ?? null,
      ]
    );

    if (itemInput.status === "NAO_APTO") {
      await query(
        `INSERT INTO ${PENDENCIAS_T}
          (frota_id, checklist_id, item_nome, gravidade, status, responsavel_id, criado_em, resolvido_em)
         VALUES (?, ?, ?, ?, 'ABERTA', NULL, current_timestamp(), NULL)`,
        [input.frota_id, checklistId, catalogItem.nome, gravidadePendencia(catalogItem)]
      );
    }
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
      return "BLOQUEADA_CHECKLIST";
    case "NAO_APTO":
      return "BLOQUEADA_CHECKLIST";
    case "COM_OBSERVACAO":
      return "PENDENTE_ANALISE";
    case "APROVADO":
    default:
      return "LIBERADA";
  }
}
