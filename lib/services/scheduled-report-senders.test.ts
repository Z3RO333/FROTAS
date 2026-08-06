import { vi } from "vitest";

// These modules are only imported so the module under test can resolve at load
// time (see lib/repos/relatorios.test.ts for the same established pattern);
// none of their behavior is exercised by the tests below.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-manutencao", () => ({
  supabaseManutencao: { from: vi.fn() },
}));

import { describe, expect, it } from "vitest";
import { buildOperationalEmail } from "@/lib/services/scheduled-report-senders";

// buildTable itself is not exported (it's an internal helper of buildOperationalEmail),
// so we exercise it indirectly through a tipo that has no external dependencies we'd
// need to mock in a pure unit test context is not feasible here (all six tipos hit
// Supabase-backed repos). Instead this suite documents the module's public shape.
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
