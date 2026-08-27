import { z } from "zod";

const ItemSchema = z.object({
  descricao: z.string().trim().min(2, "Descreva cada peça.").max(300, "A descrição deve ter no máximo 300 caracteres."),
  quantidade: z.coerce.number().int().min(1, "A quantidade mínima é 1.").max(999, "A quantidade máxima é 999."),
});

const NovoFornecedorSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do fornecedor.").max(120, "Nome muito longo."),
  email: z.string().trim().email("Informe um e-mail válido para o fornecedor."),
});

const GrupoSchema = z
  .object({
    tokenIdempotencia: z.string().uuid("Identificador da solicitação inválido."),
    frotaId: z.coerce.number().int().positive("Selecione uma frota."),
    itens: z.array(ItemSchema).min(1, "Adicione pelo menos uma peça.").max(25, "Informe no máximo 25 peças."),
    fornecedorIds: z.array(z.coerce.number().int().positive()).max(50).default([]),
    novosFornecedores: z.array(NovoFornecedorSchema).max(10, "Informe no máximo 10 fornecedores novos por frota.").default([]),
  })
  .superRefine((grupo, context) => {
    if (grupo.fornecedorIds.length === 0 && grupo.novosFornecedores.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["fornecedorIds"],
        message: "Selecione ao menos um fornecedor para cotação.",
      });
    }
  });

export const PedidoLoteSchema = z
  .object({
    grupos: z.array(GrupoSchema).min(1, "Adicione pelo menos uma frota.").max(10, "Informe no máximo 10 frotas por lote."),
  })
  .superRefine(({ grupos }, context) => {
    const ids = new Set<number>();
    grupos.forEach((grupo, index) => {
      if (ids.has(grupo.frotaId)) {
        context.addIssue({
          code: "custom",
          path: ["grupos", index, "frotaId"],
          message: "A mesma frota não pode aparecer duas vezes. Inclua todas as peças no mesmo bloco.",
        });
      }
      ids.add(grupo.frotaId);
    });
  });

export type PedidoPecasGrupoInput = z.infer<typeof GrupoSchema>;
export type PedidoLoteInput = z.infer<typeof PedidoLoteSchema>;
