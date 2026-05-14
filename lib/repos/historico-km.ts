import { query, SCHEMA_FQN } from "@/lib/db";

const T = `${SCHEMA_FQN}.historico_km_frota`;

async function safeQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await query<T>(sql, params);
  } catch (error) {
    console.warn("[historico-km] consulta indisponivel", error);
    return [];
  }
}

export type KmOrigem =
  | "CHECKLIST_INICIAL"
  | "CHECKLIST_MOTORISTA"
  | "AJUSTE_ADMIN"
  | "IMPORTACAO"
  | "OCR_HODOMETRO";

export type HistoricoKmRow = {
  id: number;
  frota_id: number;
  checklist_id: number | null;
  motorista_id: string | null;
  motorista_nome: string | null;
  km_anterior: number | null;
  km_novo: number;
  diferenca_km: number | null;
  origem: KmOrigem;
  foto_km_url: string | null;
  validado: boolean;
  validado_por: string | null;
  validado_em: string | null;
  observacao_validacao: string | null;
  criado_em: string | null;
};

export type HistoricoKmComFrota = HistoricoKmRow & {
  frota_geral: string | null;
  placa: string | null;
  modelo: string | null;
  km_atual_frota: number | null;
};

export type AppendKmInput = {
  frota_id: number;
  checklist_id: number | null;
  motorista_id: string | null;
  motorista_nome: string | null;
  km_anterior: number | null;
  km_novo: number;
  origem: KmOrigem;
  foto_km_url: string | null;
  validado: boolean;
  validado_por?: string | null;
};

export async function appendKmHistory(input: AppendKmInput): Promise<number> {
  const diferenca = input.km_anterior != null ? input.km_novo - input.km_anterior : null;
  const validadoEmSql = input.validado ? "current_timestamp()" : "NULL";

  await query(
    `INSERT INTO ${T}
      (frota_id, checklist_id, motorista_id, motorista_nome, km_anterior, km_novo,
       diferenca_km, origem, foto_km_url, validado, validado_por, validado_em,
       observacao_validacao, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${validadoEmSql}, NULL, current_timestamp())`,
    [
      input.frota_id,
      input.checklist_id,
      input.motorista_id,
      input.motorista_nome,
      input.km_anterior,
      input.km_novo,
      diferenca,
      input.origem,
      input.foto_km_url,
      input.validado,
      input.validado ? (input.validado_por ?? null) : null,
    ]
  );

  const r = await query<{ id: number }>(
    `SELECT id FROM ${T}
     WHERE frota_id = ? AND km_novo = ?
     ORDER BY id DESC LIMIT 1`,
    [input.frota_id, input.km_novo]
  );
  return Number(r[0]?.id ?? 0);
}

export async function listKmHistory(frotaId: number, limit = 100): Promise<HistoricoKmRow[]> {
  return safeQuery<HistoricoKmRow>(
    `SELECT * FROM ${T}
     WHERE frota_id = ?
     ORDER BY criado_em DESC, id DESC
     LIMIT ${limit}`,
    [frotaId]
  );
}

export async function listPendingKmValidations(limit = 100): Promise<HistoricoKmComFrota[]> {
  return safeQuery<HistoricoKmComFrota>(
    `SELECT h.*, f.frota_geral, f.placa, f.modelo, f.km_atual AS km_atual_frota
     FROM ${T} h
     LEFT JOIN ${SCHEMA_FQN}.frotas f ON f.id = h.frota_id
     WHERE h.validado = FALSE
     ORDER BY h.criado_em ASC, h.id ASC
     LIMIT ${limit}`
  );
}

export async function getKmEntry(id: number): Promise<HistoricoKmComFrota | null> {
  const r = await safeQuery<HistoricoKmComFrota>(
    `SELECT h.*, f.frota_geral, f.placa, f.modelo, f.km_atual AS km_atual_frota
     FROM ${T} h
     LEFT JOIN ${SCHEMA_FQN}.frotas f ON f.id = h.frota_id
     WHERE h.id = ?`,
    [id]
  );
  return r[0] ?? null;
}

export async function approveKmEntry(
  id: number,
  validadoPor: string,
  observacao?: string | null
): Promise<void> {
  await query(
    `UPDATE ${T}
     SET validado = TRUE, validado_por = ?, validado_em = current_timestamp(),
         observacao_validacao = ?
     WHERE id = ?`,
    [validadoPor, observacao ?? null, id]
  );
}

export async function correctKmEntry(
  id: number,
  kmCorrigido: number,
  validadoPor: string,
  observacao: string
): Promise<void> {
  await query(
    `UPDATE ${T}
     SET km_novo = ?,
         diferenca_km = CASE WHEN km_anterior IS NULL THEN NULL ELSE ? - km_anterior END,
         validado = TRUE, validado_por = ?, validado_em = current_timestamp(),
         observacao_validacao = ?
     WHERE id = ?`,
    [kmCorrigido, kmCorrigido, validadoPor, observacao, id]
  );
}

export async function countPendingKmValidations(): Promise<number> {
  const r = await safeQuery<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${T} WHERE validado = FALSE`
  );
  return Number(r[0]?.n ?? 0);
}
