import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("@/lib/rbac", () => ({ requireGestorUser: vi.fn().mockResolvedValue({ email: "gestor@bemol.com.br" }) }));
vi.mock("@/lib/repos/frotas", () => ({
  softDeleteFrota: vi.fn(), marcarFrotaVendida: vi.fn(), reativarFrota: vi.fn(),
  desfazerVendaFrota: vi.fn(), updateFrota: vi.fn(),
}));
vi.mock("@/lib/email", () => ({}));
vi.mock("@/lib/repos/frotas-cache", () => ({}));
vi.mock("@/lib/repos/disponibilidade", () => ({}));
vi.mock("@/lib/repos/planejamento", () => ({}));

import { excluirFrotaAction, marcarVendidaAction, reativarFrotaAction, desfazerVendaAction, editarFrotaAction } from "./_actions";
import { softDeleteFrota } from "@/lib/repos/frotas";
import { frotaDetailHref, frotaReturnTo } from "@/lib/navigation/search-state";

beforeEach(() => vi.clearAllMocks());

describe("retorno para a lista filtrada após alterar uma frota", () => {
  const filters = "?cd=Taruma&modelo=VOLVO&setor=Entrega&page=3&semKm=1";

  it.each([
    ["ocultar", excluirFrotaAction, "/frotas"],
    ["vender", marcarVendidaAction, "/frotas"],
    ["reativar", reativarFrotaAction, "/frotas/ocultas"],
    ["desfazer venda", desfazerVendaAction, "/frotas/vendidos"],
  ] as const)("preserva filtros e paginação ao %s", async (_, action, list) => {
    await expect(action(42, list + filters)).rejects.toThrow(`REDIRECT:${list}${filters}`);
  });

  it("preserva o retorno na ficha após salvar a edição", async () => {
    const form = new FormData();
    form.set("modelo", "VOLVO");
    form.set("returnTo", "/frotas" + filters);
    await expect(editarFrotaAction(42, { error: null, values: {}, attempt: 0 }, form))
      .rejects.toThrow(`REDIRECT:${frotaDetailHref(42, "/frotas" + filters)}`);
    const detail = new URL(frotaDetailHref(42, "/frotas" + filters), "https://app.test");
    expect(detail.searchParams.get("returnTo")).toBe("/frotas" + filters);
  });

  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "/frotas/42", "/frotas/../administracao", "/frotas\n"])("rejeita retorno inválido: %s", async (url) => {
    expect(frotaReturnTo(url)).toBeNull();
    await expect(excluirFrotaAction(42, url)).rejects.toThrow("REDIRECT:/frotas");
  });

  it("não redireciona como sucesso quando a alteração falha", async () => {
    vi.mocked(softDeleteFrota).mockRejectedValueOnce(new Error("Falha ao salvar"));
    await expect(excluirFrotaAction(42, "/frotas" + filters)).rejects.toThrow("Falha ao salvar");
  });
});
