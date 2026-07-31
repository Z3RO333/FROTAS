import { describe, expect, it } from "vitest";
import { matchesVehicleSearch } from "@/lib/checklists/vehicle-search";

const vehicle = { codigo_frota: "280", placa: "TRZ-8G44" };

describe("matchesVehicleSearch", () => {
  it("pesquisa pelo número da frota", () => {
    expect(matchesVehicleSearch(vehicle, "280")).toBe(true);
  });

  it("pesquisa a placa com ou sem pontuação", () => {
    expect(matchesVehicleSearch(vehicle, "TRZ-8G44")).toBe(true);
    expect(matchesVehicleSearch(vehicle, "trz8g44")).toBe(true);
  });

  it("aceita correspondência parcial e rejeita veículo diferente", () => {
    expect(matchesVehicleSearch(vehicle, "8G44")).toBe(true);
    expect(matchesVehicleSearch(vehicle, "QZM-3G41")).toBe(false);
  });
});
