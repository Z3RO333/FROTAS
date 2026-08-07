import { describe, expect, it } from "vitest";
import { buildRelatorioOperacionalResumoPdf } from "@/lib/relatorio-pdf";

describe("buildRelatorioOperacionalResumoPdf", () => {
  it("generates a valid, non-empty PDF buffer", async () => {
    const buf = await buildRelatorioOperacionalResumoPdf({
      dataRef: new Date("2026-08-06T00:00:00Z"),
      totalChecklists: 16,
      totalApontamentos: 2,
      frotasFizeram: [
        { frota_id: 1, localizacao: "EXPEDIÇÃO MANAUS" },
        { frota_id: 2, localizacao: "CD TURISMO/ MERCADO" },
      ],
      frotasNaoFizeram: [
        { frota_id: 3, localizacao: "MARKETPLACE" },
        { frota_id: 4, localizacao: "RO - PORTO VELHO" },
      ],
    });

    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("handles empty fleet lists without throwing", async () => {
    const buf = await buildRelatorioOperacionalResumoPdf({
      dataRef: new Date("2026-08-06T00:00:00Z"),
      totalChecklists: 0,
      totalApontamentos: 0,
      frotasFizeram: [],
      frotasNaoFizeram: [],
    });

    expect(buf.length).toBeGreaterThan(0);
  });
});
