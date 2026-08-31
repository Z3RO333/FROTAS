import { vi } from "vitest";

vi.mock("server-only", () => ({}));

const state: { rows: Array<{ id: number }> } = { rows: [] };

function makeChain() {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    limit: vi.fn(async () => ({ data: state.rows, error: null })),
  };
  return chain;
}

vi.mock("@/lib/supabase-manutencao", () => ({
  supabaseManutencao: { from: vi.fn(() => makeChain()) },
}));

import { describe, expect, it, beforeEach } from "vitest";
import { existsChecklistHojeParaFrota } from "@/lib/repos/checklists";

describe("existsChecklistHojeParaFrota", () => {
  beforeEach(() => {
    state.rows = [];
  });

  it("retorna true quando existe checklist do motorista pra frota hoje", async () => {
    state.rows = [{ id: 1 }];
    const result = await existsChecklistHojeParaFrota("motorista@bemol.com.br", 300);
    expect(result).toBe(true);
  });

  it("retorna false quando não há checklist hoje", async () => {
    state.rows = [];
    const result = await existsChecklistHojeParaFrota("motorista@bemol.com.br", 300);
    expect(result).toBe(false);
  });
});
