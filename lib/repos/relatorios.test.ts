import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-manutencao", () => ({
  supabaseManutencao: { from: vi.fn() },
}));

import { describe, expect, it } from "vitest";
import {
  agruparObservacoesPorFrota,
  agruparPendenciasPorFrota,
  extrairObservacoesValidas,
  filtraPorSetores,
  splitFrotasPorChecklist,
} from "@/lib/repos/relatorios";

describe("splitFrotasPorChecklist", () => {
  it("separates active fleets into fizeram/naoFizeram based on checklist frota ids", () => {
    const frotasAtivas = [
      { id: 1, frota_geral: "10", placa: "AAA-0001", localizacao: "CD Manaus", setor: "Expedição" },
      { id: 2, frota_geral: "20", placa: "BBB-0002", localizacao: "CD Manaus", setor: "Expedição" },
      { id: 3, frota_geral: "5", placa: "CCC-0003", localizacao: "CD Manaus", setor: "Transporte" },
    ];

    const result = splitFrotasPorChecklist(frotasAtivas, [2, 2, 3]);

    expect(result.fizeram.map((f) => f.frota_id)).toEqual([3, 2]);
    expect(result.naoFizeram.map((f) => f.frota_id)).toEqual([1]);
  });

  it("sorts each group alphabetically by frota_geral, falling back to placa then id", () => {
    const frotasAtivas = [
      { id: 1, frota_geral: null, placa: "ZZZ-0001", localizacao: null, setor: null },
      { id: 2, frota_geral: "B", placa: null, localizacao: null, setor: null },
      { id: 3, frota_geral: "A", placa: null, localizacao: null, setor: null },
    ];

    const result = splitFrotasPorChecklist(frotasAtivas, []);

    expect(result.naoFizeram.map((f) => f.frota_id)).toEqual([3, 2, 1]);
  });

  it("returns fizeram empty when no checklist ids match", () => {
    const frotasAtivas = [{ id: 1, frota_geral: "1", placa: null, localizacao: null, setor: null }];

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

describe("agruparObservacoesPorFrota", () => {
  it("groups observacoes by frota_id preserving item order", () => {
    const observacoes = [
      { frota_id: 1, frota_geral: "10", placa: "AAA-0001", motorista_nome: "Bruno", observacao: "Levando para revisão" },
      { frota_id: 1, frota_geral: "10", placa: "AAA-0001", motorista_nome: "Bruno", observacao: "Pouco óleo nos freios" },
      { frota_id: 2, frota_geral: "5", placa: "BBB-0002", motorista_nome: "Carlos", observacao: "Farol queimado" },
    ];

    const result = agruparObservacoesPorFrota(observacoes);

    expect(result).toHaveLength(2);
    expect(result[0].frota_id).toBe(2);
    expect(result[0].observacoes).toEqual([{ motorista_nome: "Carlos", observacao: "Farol queimado" }]);
    expect(result[1].frota_id).toBe(1);
    expect(result[1].observacoes).toEqual([
      { motorista_nome: "Bruno", observacao: "Levando para revisão" },
      { motorista_nome: "Bruno", observacao: "Pouco óleo nos freios" },
    ]);
  });

  it("returns an empty array for no observacoes", () => {
    expect(agruparObservacoesPorFrota([])).toEqual([]);
  });
});

describe("extrairObservacoesValidas", () => {
  it("prefers observacao_corrigida_ia over observacao_original when both are present", () => {
    const rows = [
      { frota_id: 1, motorista_nome: "Bruno", observacao_original: "texto original", observacao_corrigida_ia: "texto corrigido" },
    ];
    expect(extrairObservacoesValidas(rows)).toEqual([
      { frota_id: 1, motorista_nome: "Bruno", observacao: "texto corrigido" },
    ]);
  });

  it("falls back to observacao_original when observacao_corrigida_ia is null", () => {
    const rows = [
      { frota_id: 1, motorista_nome: "Bruno", observacao_original: "texto original", observacao_corrigida_ia: null },
    ];
    expect(extrairObservacoesValidas(rows)).toEqual([
      { frota_id: 1, motorista_nome: "Bruno", observacao: "texto original" },
    ]);
  });

  it("filters out rows where both fields are null, empty, or whitespace-only", () => {
    const rows = [
      { frota_id: 1, motorista_nome: "Bruno", observacao_original: null, observacao_corrigida_ia: null },
      { frota_id: 2, motorista_nome: "Carlos", observacao_original: "", observacao_corrigida_ia: "" },
      { frota_id: 3, motorista_nome: "Diego", observacao_original: "   ", observacao_corrigida_ia: "   " },
      { frota_id: 4, motorista_nome: "Elias", observacao_original: "válida", observacao_corrigida_ia: null },
    ];
    expect(extrairObservacoesValidas(rows)).toEqual([
      { frota_id: 4, motorista_nome: "Elias", observacao: "válida" },
    ]);
  });
});

describe("filtraPorSetores", () => {
  const frotas = [
    { frota_id: 1, setor: "EXPEDIÇÃO MANAUS", localizacao: "CD Manaus" },
    { frota_id: 2, setor: "MARKETPLACE", localizacao: "CD Manaus" },
    { frota_id: 3, setor: "CD TURISMO/ MERCADO", localizacao: "CD Tarumã" },
    { frota_id: 4, setor: null, localizacao: null },
    { frota_id: 5, setor: null, localizacao: "CD TARUMÃ LEGADO" },
  ];

  it("returns all fleets unchanged when setores is undefined or empty", () => {
    expect(filtraPorSetores(frotas)).toEqual(frotas);
    expect(filtraPorSetores(frotas, [])).toEqual(frotas);
  });

  it("keeps only fleets whose setor matches one of the given setores", () => {
    const result = filtraPorSetores(frotas, ["MARKETPLACE", "CD TURISMO/ MERCADO"]);
    expect(result.map((f) => f.frota_id)).toEqual([2, 3]);
  });

  it("matches case-insensitively and trims whitespace", () => {
    const result = filtraPorSetores(frotas, ["  marketplace  "]);
    expect(result.map((f) => f.frota_id)).toEqual([2]);
  });

  it("excludes fleets with null setor and null localizacao when a setor filter is active", () => {
    const result = filtraPorSetores(frotas, ["EXPEDIÇÃO MANAUS"]);
    expect(result.some((f) => f.frota_id === 4)).toBe(false);
  });

  it("falls back to localizacao when setor is null, so legacy fleets aren't dropped from reports", () => {
    const result = filtraPorSetores(frotas, ["CD TARUMÃ LEGADO"]);
    expect(result.map((f) => f.frota_id)).toEqual([5]);
  });
});
