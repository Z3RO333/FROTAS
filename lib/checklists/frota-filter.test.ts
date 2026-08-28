import { describe, expect, it } from "vitest";
import { filtrarFrotasPorNumeroEPlaca } from "@/lib/checklists/frota-filter";

type FrotaTeste = { frota_geral: string | null; placa: string | null };

const FROTAS: FrotaTeste[] = [
  { frota_geral: "2", placa: "ABC1234" },
  { frota_geral: "20", placa: "DEF5678" },
  { frota_geral: "218", placa: "GHI9012" },
];

describe("filtrarFrotasPorNumeroEPlaca", () => {
  it("returns every frota when both queries are empty", () => {
    expect(filtrarFrotasPorNumeroEPlaca(FROTAS, "", "")).toHaveLength(3);
  });

  it("matches only the exact frota number, not frotas containing it as a substring", () => {
    const result = filtrarFrotasPorNumeroEPlaca(FROTAS, "2", "");
    expect(result).toEqual([FROTAS[0]]);
  });

  it("matches the plate case-insensitively but requires an exact match", () => {
    const result = filtrarFrotasPorNumeroEPlaca(FROTAS, "", "abc1234");
    expect(result).toEqual([FROTAS[0]]);
  });

  it("does not match a plate that only contains the query as a substring", () => {
    const result = filtrarFrotasPorNumeroEPlaca(FROTAS, "", "ABC123");
    expect(result).toEqual([]);
  });

  it("combines both filters with AND", () => {
    const result = filtrarFrotasPorNumeroEPlaca(FROTAS, "20", "DEF5678");
    expect(result).toEqual([FROTAS[1]]);
  });
});
