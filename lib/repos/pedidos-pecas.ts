import "server-only";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type PedidoPecasStatus =
  | "PENDENTE_ENVIO"
  | "ENVIANDO"
  | "ENVIADO"
  | "PARCIAL"
  | "ERRO_ENVIO";

export type PedidoPecasEnvioStatus = "PENDENTE" | "ENVIANDO" | "ENVIADO" | "ERRO";

export type PedidoPecasItem = {
  id: number;
  ordem: number;
  descricao: string;
  quantidade: number;
};

export type PedidoPecasEnvio = {
  id: number;
  fornecedor_nome: string;
  fornecedor_email: string;
  copia_email: string;
  status: PedidoPecasEnvioStatus;
  tentativas: number;
  message_id: string | null;
  erro_msg: string | null;
  enviado_em: string | null;
  atualizado_em: string;
};

export type PedidoPecas = {
  id: number;
  codigo: string;
  frota_id: number | null;
  frota_codigo: string;
  placa: string | null;
  modelo: string | null;
  chassi: string | null;
  ano_fabricacao: number | null;
  observacao: string | null;
  solicitante_nome: string;
  solicitante_email: string;
  status: PedidoPecasStatus;
  enviado_em: string | null;
  criado_em: string;
  atualizado_em: string;
  itens: PedidoPecasItem[];
  envios: PedidoPecasEnvio[];
};

export type NovoPedidoPecas = {
  tokenIdempotencia: string;
  frotaId: number;
  itens: Array<{ descricao: string; quantidade: number }>;
  observacao?: string | null;
  solicitanteNome: string;
  solicitanteEmail: string;
  copiaEmail: string;
};

type PedidoRow = Omit<PedidoPecas, "itens" | "envios"> & {
  pedido_pecas_itens?: PedidoPecasItem[] | null;
  pedido_pecas_envios?: PedidoPecasEnvio[] | null;
};

const PEDIDO_SELECT = `
  id,codigo,frota_id,frota_codigo,placa,modelo,chassi,ano_fabricacao,observacao,
  solicitante_nome,solicitante_email,status,enviado_em,criado_em,atualizado_em,
  pedido_pecas_itens(id,ordem,descricao,quantidade),
  pedido_pecas_envios(id,fornecedor_nome,fornecedor_email,copia_email,status,tentativas,message_id,erro_msg,enviado_em,atualizado_em)
`;

function fromRow(row: PedidoRow): PedidoPecas {
  const { pedido_pecas_itens, pedido_pecas_envios, ...pedido } = row;
  return {
    ...pedido,
    id: Number(pedido.id),
    frota_id: pedido.frota_id == null ? null : Number(pedido.frota_id),
    ano_fabricacao: pedido.ano_fabricacao == null ? null : Number(pedido.ano_fabricacao),
    itens: (pedido_pecas_itens ?? [])
      .map((item) => ({ ...item, id: Number(item.id), ordem: Number(item.ordem), quantidade: Number(item.quantidade) }))
      .sort((a, b) => a.ordem - b.ordem),
    envios: (pedido_pecas_envios ?? [])
      .map((envio) => ({ ...envio, id: Number(envio.id), tentativas: Number(envio.tentativas) }))
      .sort((a, b) => a.id - b.id),
  };
}

export async function criarPedidoPecas(input: NovoPedidoPecas): Promise<number> {
  const { data, error } = await supabaseManutencao.rpc("criar_pedido_pecas", {
    p_token_idempotencia: input.tokenIdempotencia,
    p_frota_id: input.frotaId,
    p_itens: input.itens,
    p_observacao: input.observacao ?? "",
    p_solicitante_nome: input.solicitanteNome,
    p_solicitante_email: input.solicitanteEmail,
    p_copia_email: input.copiaEmail,
  });
  if (error) throw new Error(`criarPedidoPecas: ${error.message}`);
  const id = Number(data);
  if (!Number.isInteger(id) || id <= 0) throw new Error("O pedido foi criado sem um identificador valido.");
  return id;
}

export async function getPedidoPecas(id: number): Promise<PedidoPecas | null> {
  const { data, error } = await supabaseManutencao
    .from("pedidos_pecas")
    .select(PEDIDO_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getPedidoPecas: ${error.message}`);
  return data ? fromRow(data as unknown as PedidoRow) : null;
}

export async function listPedidosPecas(limit = 100): Promise<PedidoPecas[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const { data, error } = await supabaseManutencao
    .from("pedidos_pecas")
    .select(PEDIDO_SELECT)
    .order("criado_em", { ascending: false })
    .limit(safeLimit);
  if (error) throw new Error(`listPedidosPecas: ${error.message}`);
  return ((data ?? []) as unknown as PedidoRow[]).map(fromRow);
}

export async function iniciarEnvioPedidoPecas(pedidoId: number, envioId: number): Promise<void> {
  const agora = new Date().toISOString();
  const [{ error: pedidoError }, { data: envio, error: envioError }] = await Promise.all([
    supabaseManutencao
      .from("pedidos_pecas")
      .update({ status: "ENVIANDO", atualizado_em: agora })
      .eq("id", pedidoId),
    supabaseManutencao
      .from("pedido_pecas_envios")
      .update({ status: "ENVIANDO", erro_msg: null, atualizado_em: agora })
      .eq("id", envioId)
      .eq("pedido_id", pedidoId)
      .neq("status", "ENVIADO")
      .select("id,tentativas")
      .maybeSingle(),
  ]);
  if (pedidoError) throw new Error(`iniciarEnvioPedidoPecas(pedido): ${pedidoError.message}`);
  if (envioError) throw new Error(`iniciarEnvioPedidoPecas(envio): ${envioError.message}`);
  if (!envio) throw new Error("Envio ja concluido ou nao encontrado.");

  const { error: tentativaError } = await supabaseManutencao
    .from("pedido_pecas_envios")
    .update({ tentativas: Number(envio.tentativas ?? 0) + 1, atualizado_em: agora })
    .eq("id", envioId);
  if (tentativaError) throw new Error(`iniciarEnvioPedidoPecas(tentativa): ${tentativaError.message}`);
}

export async function concluirEnvioPedidoPecas(
  envioId: number,
  result: { ok: true; messageId: string | null } | { ok: false; error: string }
): Promise<void> {
  const agora = new Date().toISOString();
  const payload = result.ok
    ? {
        status: "ENVIADO" as const,
        message_id: result.messageId,
        erro_msg: null,
        enviado_em: agora,
        atualizado_em: agora,
      }
    : {
        status: "ERRO" as const,
        message_id: null,
        erro_msg: result.error.slice(0, 2000),
        enviado_em: null,
        atualizado_em: agora,
      };
  const { error } = await supabaseManutencao.from("pedido_pecas_envios").update(payload).eq("id", envioId);
  if (error) throw new Error(`concluirEnvioPedidoPecas: ${error.message}`);
}

export async function recalcularStatusPedidoPecas(pedidoId: number): Promise<PedidoPecasStatus> {
  const { data, error } = await supabaseManutencao
    .from("pedido_pecas_envios")
    .select("status")
    .eq("pedido_id", pedidoId);
  if (error) throw new Error(`recalcularStatusPedidoPecas(envios): ${error.message}`);

  const statuses = (data ?? []).map((row: { status: PedidoPecasEnvioStatus }) => row.status);
  const enviados = statuses.filter((status) => status === "ENVIADO").length;
  const status: PedidoPecasStatus =
    statuses.length > 0 && enviados === statuses.length
      ? "ENVIADO"
      : enviados > 0
        ? "PARCIAL"
        : "ERRO_ENVIO";
  const agora = new Date().toISOString();
  const { error: updateError } = await supabaseManutencao
    .from("pedidos_pecas")
    .update({
      status,
      enviado_em: status === "ENVIADO" ? agora : null,
      atualizado_em: agora,
    })
    .eq("id", pedidoId);
  if (updateError) throw new Error(`recalcularStatusPedidoPecas(pedido): ${updateError.message}`);
  return status;
}
