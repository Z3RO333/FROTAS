import { execute, query } from "@/lib/db";

export type HistoricoEntry = {
  id: number;
  frota_id: number;
  campo: string;
  valor_antigo: string | null;
  valor_novo: string | null;
  alterado_em: string;
  alterado_por: string;
};

export async function listHistorico(frotaId: number): Promise<HistoricoEntry[]> {
  return query<HistoricoEntry>(
    `SELECT * FROM manutencao.cd.frotas_historico WHERE frota_id = ? ORDER BY alterado_em DESC LIMIT 200`,
    [frotaId]
  );
}

export async function appendHistorico(
  frotaId: number,
  campo: string,
  valorAntigo: string | null,
  valorNovo: string | null,
  userEmail: string
) {
  await execute(
    `INSERT INTO manutencao.cd.frotas_historico
      (frota_id, campo, valor_antigo, valor_novo, alterado_em, alterado_por)
     VALUES (?, ?, ?, ?, current_timestamp(), ?)`,
    [frotaId, campo, valorAntigo, valorNovo, userEmail]
  );
}

export async function listHistoricoKm(
  frotaId: number
): Promise<{ alterado_em: string; valor_novo: string }[]> {
  return query(
    `SELECT alterado_em, valor_novo FROM manutencao.cd.frotas_historico
     WHERE frota_id = ? AND campo = 'km' ORDER BY alterado_em ASC`,
    [frotaId]
  );
}
