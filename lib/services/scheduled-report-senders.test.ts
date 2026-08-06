import { vi } from "vitest";

// These modules are only imported so the module under test can resolve at load
// time (see lib/repos/relatorios.test.ts for the same established pattern);
// none of their behavior is exercised by the tests below.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-manutencao", () => ({
  supabaseManutencao: { from: vi.fn() },
}));

import { describe, expect, it } from "vitest";
import { buildOperationalEmail, buildTable } from "@/lib/services/scheduled-report-senders";

describe("scheduled-report-senders module shape", () => {
  it("exports buildOperationalEmail as an async function", () => {
    expect(typeof buildOperationalEmail).toBe("function");
  });

  it("rejects an unsupported tipo with a clear error", async () => {
    await expect(buildOperationalEmail("TIPO_INEXISTENTE", new Date())).rejects.toThrow(
      /Tipo de agenda não suportado/
    );
  });
});

describe("buildTable", () => {
  const generatedAt = new Date("2026-01-15T12:00:00Z");

  it("renders the title and resumo with the correct row count", () => {
    const rows = [
      { Frota: "101", Placa: "ABC1234" },
      { Frota: "102", Placa: "DEF5678" },
    ];
    const { html, resumo } = buildTable("Relatório de teste", rows, generatedAt);

    expect(html).toContain("Relatório de teste");
    expect(resumo).toBe("2 registro(s) encontrado(s).");
  });

  it("shows the empty-state message and a zero-count resumo when rows is empty", () => {
    const { html, resumo } = buildTable("Relatório vazio", [], generatedAt);

    expect(html).toContain("Nenhum registro encontrado para este relatório.");
    expect(resumo).toBe("0 registro(s) encontrado(s).");
  });

  it("truncates to the first 100 rows but keeps the true total in resumo", () => {
    const rows = Array.from({ length: 150 }, (_, i) => ({ Frota: String(i) }));
    const { html, resumo } = buildTable("Relatório grande", rows, generatedAt);

    const rowMatches = html.match(/<td style="padding:8px;border:1px solid #e2e8f0">/g) ?? [];
    expect(rowMatches.length).toBe(100);
    expect(html).toContain("Exibindo os primeiros 100 registros.");
    expect(resumo).toBe("150 registro(s) encontrado(s).");
  });
});
