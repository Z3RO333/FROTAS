"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireManutencaoUser } from "@/lib/rbac";
import { criarFornecedorPecas, dedupeNovosFornecedores } from "@/lib/repos/fornecedores-pecas";
import { criarPedidoPecas } from "@/lib/repos/pedidos-pecas";
import { enviarCotacoesPedidoPecas, PEDIDOS_PECAS_CC } from "@/lib/services/pedidos-pecas-email";
import { PedidoLoteSchema } from "./_schema";

export type PedidoPecasGrupoValues = {
  tokenIdempotencia: string;
  frotaId: number | null;
  itens: Array<{ descricao: string; quantidade: number }>;
  fornecedorIds: number[];
  novosFornecedores: Array<{ nome: string; email: string }>;
};

export type PedidoPecasFormValues = {
  grupos: PedidoPecasGrupoValues[];
};

export type PedidoPecasActionState = {
  error: string | null;
  values: PedidoPecasFormValues | null;
  attempt: number;
};

function parseJson(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string") return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function rawValues(formData: FormData): PedidoPecasFormValues {
  const gruposRaw = parseJson(formData.get("grupos"));
  return {
    grupos: Array.isArray(gruposRaw)
      ? gruposRaw.map((grupo) => {
          const frota = Number(grupo?.frotaId);
          return {
            tokenIdempotencia: String(grupo?.tokenIdempotencia ?? ""),
            frotaId: Number.isInteger(frota) && frota > 0 ? frota : null,
            itens: Array.isArray(grupo?.itens)
              ? grupo.itens.map((item: { descricao?: unknown; quantidade?: unknown }) => ({
                  descricao: typeof item?.descricao === "string" ? item.descricao : "",
                  quantidade: Number(item?.quantidade) || 1,
                }))
              : [],
            fornecedorIds: Array.isArray(grupo?.fornecedorIds)
              ? grupo.fornecedorIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
              : [],
            novosFornecedores: Array.isArray(grupo?.novosFornecedores)
              ? grupo.novosFornecedores.map((f: { nome?: unknown; email?: unknown }) => ({
                  nome: typeof f?.nome === "string" ? f.nome : "",
                  email: typeof f?.email === "string" ? f.email : "",
                }))
              : [],
          };
        })
      : [],
  };
}

function publicMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Revise os dados do pedido.";
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Frota nao encontrada")) return "A frota selecionada não foi encontrada ou está inativa.";
  if (message.includes("fornecedor")) return "Selecione ao menos um fornecedor ativo para cada frota.";
  return "Não foi possível registrar o pedido. Tente novamente.";
}

export async function criarPedidoPecasAction(
  previousState: PedidoPecasActionState,
  formData: FormData
): Promise<PedidoPecasActionState> {
  const user = await requireManutencaoUser();
  const values = rawValues(formData);
  const pedidoIds: number[] = [];

  try {
    const parsed = PedidoLoteSchema.parse(values);
    for (const grupo of parsed.grupos) {
      const novos = dedupeNovosFornecedores(grupo.novosFornecedores);
      const novosCriados = await Promise.all(novos.map((novo) => criarFornecedorPecas(novo)));
      const fornecedorIds = Array.from(new Set([...grupo.fornecedorIds, ...novosCriados.map((f) => f.id)]));

      pedidoIds.push(await criarPedidoPecas({
        tokenIdempotencia: grupo.tokenIdempotencia,
        frotaId: grupo.frotaId,
        itens: grupo.itens,
        observacao: "",
        solicitanteNome: user.name,
        solicitanteEmail: user.email,
        copiaEmail: PEDIDOS_PECAS_CC,
        fornecedorIds,
      }));
    }
  } catch (error) {
    console.error("[pedidos-pecas] erro ao criar pedido", error);
    return {
      error: publicMessage(error),
      values,
      attempt: previousState.attempt + 1,
    };
  }

  let enviados = 0;
  let parciais = 0;
  for (const pedidoId of pedidoIds) {
    try {
      const envio = await enviarCotacoesPedidoPecas(pedidoId, user.email);
      if (envio.status === "ENVIADO") enviados += 1;
      else if (envio.status === "PARCIAL") parciais += 1;
    } catch (error) {
      console.error(`[pedidos-pecas] pedido ${pedidoId} criado, mas o envio falhou`, error);
    }
  }

  revalidatePath("/manutencao/pecas");
  if (pedidoIds.length === 1) {
    const resultado = enviados === 1 ? "enviado" : parciais === 1 ? "parcial" : "erro";
    redirect(`/manutencao/pecas/${pedidoIds[0]}?resultado=${resultado}`);
  }

  const params = new URLSearchParams({
    resultado: "lote",
    total: String(pedidoIds.length),
    enviados: String(enviados),
    parciais: String(parciais),
    erros: String(pedidoIds.length - enviados - parciais),
  });
  redirect(`/manutencao/pecas?${params.toString()}`);
}

export async function reenviarCotacoesPedidoPecasAction(formData: FormData): Promise<void> {
  const user = await requireManutencaoUser();
  const pedidoId = z.coerce.number().int().positive().parse(formData.get("pedido_id"));
  let resultado = "erro";
  try {
    const envio = await enviarCotacoesPedidoPecas(pedidoId, user.email);
    resultado = envio.status === "ENVIADO" ? "enviado" : envio.status === "PARCIAL" ? "parcial" : "erro";
  } catch (error) {
    console.error(`[pedidos-pecas] falha ao reenviar pedido ${pedidoId}`, error);
  }
  revalidatePath("/manutencao/pecas");
  revalidatePath(`/manutencao/pecas/${pedidoId}`);
  redirect(`/manutencao/pecas/${pedidoId}?resultado=${resultado}`);
}
