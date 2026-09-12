import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("@/lib/rbac", () => ({ requireGestorUser: vi.fn().mockResolvedValue({ email: "gestor@bemol.com.br" }) }));
vi.mock("@/lib/repos/frotas", () => ({
  softDeleteFrota: vi.fn(), marcarFrotaVendida: vi.fn(), reativarFrota: vi.fn(),
  desfazerVendaFrota: vi.fn(), updateFrota: vi.fn(), findFrotaAtivaConflitante: vi.fn(),
}));
vi.mock("@/lib/email", () => ({}));
vi.mock("@/lib/repos/frotas-cache", () => ({}));
vi.mock("@/lib/repos/disponibilidade", () => ({}));
vi.mock("@/lib/repos/planejamento", () => ({}));

import { excluirFrotaAction, marcarVendidaAction, reativarFrotaAction, desfazerVendaAction, editarFrotaAction } from "./_actions";
import { softDeleteFrota, updateFrota, findFrotaAtivaConflitante } from "@/lib/repos/frotas";
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

describe("conflito de placa/chassi/renavam com frota ativa", () => {
  it("oferece ocultar a frota ativa conflitante em vez de só bloquear", async () => {
    vi.mocked(updateFrota).mockRejectedValueOnce(new Error("updateFrota: Placa já cadastrada em outra frota"));
    vi.mocked(findFrotaAtivaConflitante).mockResolvedValueOnce({ id: 7, label: "FROTA-007" });

    const form = new FormData();
    form.set("placa", "ABC1234");
    const result = await editarFrotaAction(42, { error: null, values: {}, attempt: 0 }, form);

    expect(findFrotaAtivaConflitante).toHaveBeenCalledWith("placa", "ABC1234", 42);
    expect(result.error).toBeNull();
    expect(result.conflict).toEqual({ frotaId: 7, label: "FROTA-007", campo: "placa" });
  });

  it("cai no erro genérico quando não encontra frota ativa conflitante", async () => {
    vi.mocked(updateFrota).mockRejectedValueOnce(new Error("updateFrota: Placa já cadastrada em outra frota"));
    vi.mocked(findFrotaAtivaConflitante).mockResolvedValueOnce(null);

    const form = new FormData();
    form.set("placa", "ABC1234");
    const result = await editarFrotaAction(42, { error: null, values: {}, attempt: 0 }, form);

    expect(result.conflict).toBeUndefined();
    expect(result.error).toBe("Esta placa já está cadastrada em outra frota.");
  });

  it("oculta a frota conflitante antes de salvar quando confirmado", async () => {
    const form = new FormData();
    form.set("modelo", "VOLVO");
    form.set("confirmarOcultarFrotaId", "7");
    form.set("returnTo", "/frotas");
    await expect(editarFrotaAction(42, { error: null, values: {}, attempt: 0 }, form)).rejects.toThrow("REDIRECT:");

    expect(softDeleteFrota).toHaveBeenCalledWith(7, "gestor@bemol.com.br");
    expect(vi.mocked(softDeleteFrota).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(updateFrota).mock.invocationCallOrder[0]
    );
  });
});
