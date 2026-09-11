import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type SetorComContagem = {
  setor: string;
  total: number;
};

/**
 * Funde um setor duplicado no outro (ou renomeia/limpa) dentro da lista de
 * setores marcados numa agenda de e-mail — sem duplicar a entrada quando o
 * nome de destino já está na lista, e descartando entradas que ficariam
 * vazias (nomeNovo=null, o "apagar").
 */
export function mergeSetorArray(setores: string[], nomeAtual: string, nomeNovo: string | null): string[] {
  const mapeado = setores.map((s) => (s === nomeAtual ? nomeNovo : s));
  const limpo = mapeado.filter((s): s is string => s != null && s.trim() !== "");
  return [...new Set(limpo)];
}

/**
 * Mesma fusão, mas para o mapa setor→destinatários de uma agenda. Quando o
 * setor de destino já tem destinatários próprios, os e-mails do setor antigo
 * se somam aos existentes (sem duplicar); ninguém deixa de receber o
 * relatório só porque o setor foi renomeado.
 */
export function mergeDestinatariosPorSetor(
  destinatariosPorSetor: Record<string, string[]>,
  nomeAtual: string,
  nomeNovo: string | null
): Record<string, string[]> {
  const resultado = { ...destinatariosPorSetor };
  const antigos = resultado[nomeAtual];
  delete resultado[nomeAtual];

  if (nomeNovo && antigos?.length) {
    const existentes = resultado[nomeNovo] ?? [];
    resultado[nomeNovo] = [...new Set([...existentes, ...antigos])];
  }

  return resultado;
}

/** Todos os setores cadastrados em veiculos.setor, com quantas frotas usam cada um — inclui ocultas/vendidas, porque o objetivo é padronizar tudo, não só o que está visível hoje. */
export async function listSetoresComContagem(): Promise<SetorComContagem[]> {
  const rows: { setor: string | null }[] = [];
  const chunkSize = 1000;
  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await supabaseManutencao
      .from("veiculos")
      .select("setor")
      .not("setor", "is", null)
      .order("id", { ascending: true })
      .range(from, from + chunkSize - 1);
    if (error) throw new Error(`listSetoresComContagem: ${error.message}`);
    const chunk = (data ?? []) as { setor: string | null }[];
    rows.push(...chunk);
    if (chunk.length < chunkSize) break;
  }

  const contagem = new Map<string, number>();
  for (const row of rows) {
    const setor = row.setor?.trim();
    if (!setor) continue;
    contagem.set(setor, (contagem.get(setor) ?? 0) + 1);
  }

  return [...contagem.entries()]
    .map(([setor, total]) => ({ setor, total }))
    .sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"));
}

export type RenomearSetorResultado = {
  frotasAtualizadas: number;
  agendasAtualizadas: number;
};

/**
 * Renomeia um setor em todas as frotas vinculadas. Se nomeNovo coincidir com
 * um setor que já existe, os dois se fundem num só (mesma string = mesmo
 * grupo em toda a aplicação). Nome novo em branco limpa o setor das frotas
 * (equivale a "apagar" o setor).
 *
 * Também atualiza as agendas de e-mail (setores_incluidos e
 * destinatarios_por_setor) que referenciam o nome antigo — sem isso, uma
 * agenda ficaria apontando pra um setor que não existe mais em nenhuma
 * frota e passaria a gerar o relatório zerado (mesmo bug de "CD TURISMO/
 * FARMA" que motivou o guard em sendOperationalScheduleReports).
 */
export async function renomearSetor(
  nomeAtual: string,
  nomeNovoBruto: string,
  userEmail: string
): Promise<RenomearSetorResultado> {
  const atual = nomeAtual.trim();
  const novo = nomeNovoBruto.trim();
  if (!atual) throw new Error("Setor atual inválido.");
  if (atual === novo) throw new Error("O novo nome é igual ao atual.");
  const nomeNovo = novo || null;

  const { data: frotas, error: errFrotas } = await supabaseManutencao
    .from("veiculos")
    .update({ setor: nomeNovo, atualizado_por: userEmail })
    .eq("setor", atual)
    .select("id");
  if (errFrotas) throw new Error(`renomearSetor: ${errFrotas.message}`);

  const { data: schedules, error: errSchedules } = await supabaseManutencao
    .from("email_schedules")
    .select("id, setores_incluidos, destinatarios_por_setor")
    .contains("setores_incluidos", [atual]);
  if (errSchedules) throw new Error(`renomearSetor (agendas): ${errSchedules.message}`);

  const scheduleRows = (schedules ?? []) as {
    id: number;
    setores_incluidos: string[];
    destinatarios_por_setor: Record<string, string[]> | null;
  }[];

  for (const schedule of scheduleRows) {
    const setoresNovos = mergeSetorArray(schedule.setores_incluidos ?? [], atual, nomeNovo);
    const destinatariosNovos = mergeDestinatariosPorSetor(
      schedule.destinatarios_por_setor ?? {},
      atual,
      nomeNovo
    );
    const { error } = await supabaseManutencao
      .from("email_schedules")
      .update({ setores_incluidos: setoresNovos, destinatarios_por_setor: destinatariosNovos })
      .eq("id", schedule.id);
    if (error) throw new Error(`renomearSetor (agenda ${schedule.id}): ${error.message}`);
  }

  return { frotasAtualizadas: frotas?.length ?? 0, agendasAtualizadas: scheduleRows.length };
}
