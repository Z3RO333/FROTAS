import { query, SCHEMA_FQN } from "@/lib/db";

const T = `${SCHEMA_FQN}.abastecimentos_frota`;

export type AbastecimentoOrigem =
  | "CHECKLIST"
  | "ABASTECIMENTO_MANUAL"
  | "IMPORTACAO";

export type AbastecimentoRow = {
  id: number;
  frota_id: number;
  motorista_id: string | null;
  motorista_nome: string | null;
  checklist_id: number | null;
  data_hora: string | null;
  tipo_combustivel: string | null;
  litros_combustivel: number | null;
  litros_arla: number | null;
  km_no_abastecimento: number | null;
  foto_comprovante_url: string | null;
  origem: AbastecimentoOrigem;
  criado_em: string | null;
};

export type CreateAbastecimentoInput = {
  frota_id: number;
  motorista_id: string | null;
  motorista_nome: string | null;
  checklist_id: number | null;
  tipo_combustivel?: string | null;
  litros_combustivel?: number | null;
  litros_arla?: number | null;
  km_no_abastecimento?: number | null;
  foto_comprovante_url?: string | null;
  origem: AbastecimentoOrigem;
};

export async function createAbastecimento(input: CreateAbastecimentoInput): Promise<number> {
  await query(
    `INSERT INTO ${T}
      (frota_id, motorista_id, motorista_nome, checklist_id, data_hora,
       tipo_combustivel, litros_combustivel, litros_arla, km_no_abastecimento,
       foto_comprovante_url, origem, criado_em)
     VALUES (?, ?, ?, ?, current_timestamp(), ?, ?, ?, ?, ?, ?, current_timestamp())`,
    [
      input.frota_id,
      input.motorista_id,
      input.motorista_nome,
      input.checklist_id,
      input.tipo_combustivel ?? null,
      input.litros_combustivel ?? null,
      input.litros_arla ?? null,
      input.km_no_abastecimento ?? null,
      input.foto_comprovante_url ?? null,
      input.origem,
    ]
  );

  const r = await query<{ id: number }>(
    `SELECT id FROM ${T}
     WHERE frota_id = ?
     ORDER BY id DESC LIMIT 1`,
    [input.frota_id]
  );
  return Number(r[0]?.id ?? 0);
}

export async function listAbastecimentosFrota(
  frotaId: number,
  limit = 50
): Promise<AbastecimentoRow[]> {
  return query<AbastecimentoRow>(
    `SELECT * FROM ${T}
     WHERE frota_id = ?
     ORDER BY data_hora DESC, id DESC
     LIMIT ${limit}`,
    [frotaId]
  );
}
