import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-manutencao", () => ({
  supabaseManutencao: { from: vi.fn() },
}));

import { describe, expect, it } from "vitest";
import { agruparPendenciasPorFrota, splitFrotasPorChecklist } from "@/lib/repos/relatorios";

describe("splitFrotasPorChecklist", () => {
  it("separates active fleets into fizeram/naoFizeram based on checklist frota ids", () => {
    const frotasAtivas = [
      { id: 1, frota_geral: "10", placa: "AAA-0001" },
      { id: 2, frota_geral: "20", placa: "BBB-0002" },
      { id: 3, frota_geral: "5", placa: "CCC-0003" },
    ];

    const result = splitFrotasPorChecklist(frotasAtivas, [2, 2, 3]);

    expect(result.fizeram.map((f) => f.frota_id)).toEqual([3, 2]);
    expect(result.naoFizeram.map((f) => f.frota_id)).toEqual([1]);
  });

  it("sorts each group alphabetically by frota_geral, falling back to placa then id", () => {
    const frotasAtivas = [
      { id: 1, frota_geral: null, placa: "ZZZ-0001" },
      { id: 2, frota_geral: "B", placa: null },
      { id: 3, frota_geral: "A", placa: null },
    ];

    const result = splitFrotasPorChecklist(frotasAtivas, []);

    expect(result.naoFizeram.map((f) => f.frota_id)).toEqual([3, 2, 1]);
  });

  it("returns fizeram empty when no checklist ids match", () => {
    const frotasAtivas = [{ id: 1, frota_geral: "1", placa: null }];

    const result = splitFrotasPorChecklist(frotasAtivas, []);

    expect(result.fizeram).toEqual([]);
    expect(result.naoFizeram).toHaveLength(1);
  });
});

describe("agruparPendenciasPorFrota", () => {
  it("groups pendencias by frota_id preserving item order", () => {
    const pendencias = [
      { frota_id: 1, frota_geral: "10", placa: "AAA-0001", item_nome: "Pneu", gravidade: "ALTA" },
      { frota_id: 1, frota_geral: "10", placa: "AAA-0001", item_nome: "Farol", gravidade: "BAIXA" },
      { frota_id: 2, frota_geral: "5", placa: "BBB-0002", item_nome: "Freio", gravidade: "CRITICA" },
    ];

    const result = agruparPendenciasPorFrota(pendencias);

    expect(result).toHaveLength(2);
    expect(result[0].frota_id).toBe(2);
    expect(result[0].itens).toEqual([{ item_nome: "Freio", gravidade: "CRITICA" }]);
    expect(result[1].frota_id).toBe(1);
    expect(result[1].itens).toEqual([
      { item_nome: "Pneu", gravidade: "ALTA" },
      { item_nome: "Farol", gravidade: "BAIXA" },
    ]);
  });

  it("returns an empty array for no pendencias", () => {
    expect(agruparPendenciasPorFrota([])).toEqual([]);
  });
});
