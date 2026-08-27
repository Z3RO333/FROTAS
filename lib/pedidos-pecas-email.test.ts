import { describe, expect, it } from "vitest";
import { pedidoPecasSubject, renderPedidoPecasEmail } from "@/lib/pedidos-pecas-email";
import type { PedidoPecas } from "@/lib/repos/pedidos-pecas";

const PEDIDO: PedidoPecas = {
  id: 1,
  codigo: "PC-20260827-00001",
  frota_id: 121,
  frota_codigo: "255",
  placa: "TAF-3G38",
  modelo: "ACCELO 817/ M. BENZ",
  chassi: "9BM951102RB366384",
  ano_fabricacao: 2024,
  observacao: "Entrega no CD1 <urgente>",
  solicitante_nome: "Gustavo",
  solicitante_email: "gustavo@bemol.com.br",
  status: "PENDENTE_ENVIO",
  enviado_em: null,
  criado_em: "2026-08-27T13:00:00Z",
  atualizado_em: "2026-08-27T13:00:00Z",
  itens: [
    { id: 1, ordem: 1, descricao: "Lanterna LED & suporte", quantidade: 2 },
    { id: 2, ordem: 2, descricao: "Filtro de combustivel", quantidade: 1 },
  ],
  envios: [],
};

describe("pedidoPecasSubject", () => {
  it("identifica a frota e o pedido", () => {
    expect(pedidoPecasSubject(PEDIDO)).toBe(
      "Solicitação de orçamento | Frota 255 | PC-20260827-00001"
    );
  });
});

describe("renderPedidoPecasEmail", () => {
  it("renderiza os dados oficiais e escapa entradas do usuario", () => {
    const html = renderPedidoPecasEmail(PEDIDO);
    expect(html).toContain("TAF-3G38");
    expect(html).toContain("ACCELO 817/ M. BENZ");
    expect(html).toContain("2 - Lanterna LED &amp; suporte");
    expect(html).toContain("1 - Filtro de combustivel");
    expect(html).not.toContain("Entrega no CD1");
  });
});
