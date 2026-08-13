import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type NotificacaoEvento = "SOCORRO_GERAL" | "SOCORRO_AREA" | "SINISTRO_GERAL";

export type NotificacaoDestinatario = {
  id: number;
  evento: NotificacaoEvento;
  chave: string | null;
  destinatarios: string[];
  atualizadoEm: string;
  atualizadoPor: string | null;
};

type NotificacaoDestinatarioRow = {
  id: number;
  evento: NotificacaoEvento;
  chave: string;
  destinatarios: string[] | null;
  atualizado_em: string;
  atualizado_por: string | null;
};

// Banco usa "" (nao NULL) como sentinela de "sem area" — evita a armadilha
// do Postgres onde unique(evento, chave) nao bloqueia duplicatas com chave
// NULL. A API deste modulo continua expondo null pra quem consome.
function fromRow(row: NotificacaoDestinatarioRow): NotificacaoDestinatario {
  return {
    id: row.id,
    evento: row.evento,
    chave: row.chave === "" ? null : row.chave,
    destinatarios: row.destinatarios ?? [],
    atualizadoEm: row.atualizado_em,
    atualizadoPor: row.atualizado_por,
  };
}

export async function listNotificacaoDestinatarios(): Promise<NotificacaoDestinatario[]> {
  const { data, error } = await supabaseManutencao
    .from("notificacao_destinatarios")
    .select("id,evento,chave,destinatarios,atualizado_em,atualizado_por")
    .order("evento", { ascending: true })
    .order("chave", { ascending: true, nullsFirst: true });
  if (error) throw new Error(`listNotificacaoDestinatarios: ${error.message}`);
  return (data ?? []).map(fromRow);
}

/**
 * Destinatarios efetivos para um evento/chave: retorna [] (nao null) quando
 * a linha nao existe ou nao tem nenhum e-mail cadastrado, para o chamador
 * decidir se avisa/loga em vez de falhar silenciosamente.
 */
export async function getDestinatarios(evento: NotificacaoEvento, chave: string | null = null): Promise<string[]> {
  const { data, error } = await supabaseManutencao
    .from("notificacao_destinatarios")
    .select("destinatarios")
    .eq("evento", evento)
    .eq("chave", chave ?? "")
    .maybeSingle();
  if (error) throw new Error(`getDestinatarios: ${error.message}`);
  return data?.destinatarios ?? [];
}

export async function updateDestinatarios(
  evento: NotificacaoEvento,
  chave: string | null,
  destinatarios: string[],
  atualizadoPor: string
): Promise<void> {
  const { error } = await supabaseManutencao
    .from("notificacao_destinatarios")
    .upsert(
      {
        evento,
        chave: chave ?? "",
        destinatarios,
        atualizado_em: new Date().toISOString(),
        atualizado_por: atualizadoPor,
      },
      { onConflict: "evento,chave" }
    );
  if (error) throw new Error(`updateDestinatarios: ${error.message}`);
}
