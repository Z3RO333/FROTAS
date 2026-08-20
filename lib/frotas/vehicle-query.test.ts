import { describe, expect, it } from "vitest";
import { classifyVehicleQuery } from "./vehicle-query";

describe("classifyVehicleQuery", () => {
  it("classifica número puro como código de frota (busca exata)", () => {
    expect(classifyVehicleQuery("2")).toEqual({ kind: "fleet-code", value: "2" });
    expect(classifyVehicleQuery("244")).toEqual({ kind: "fleet-code", value: "244" });
  });

  it("classifica placa como texto (busca parcial)", () => {
    expect(classifyVehicleQuery("QZA-2A34").kind).toBe("text");
  });

  it("classifica modelo como texto (busca parcial)", () => {
    expect(classifyVehicleQuery("Sprinter").kind).toBe("text");
  });

  it("trata número com espaços em volta como código de frota, já aparado", () => {
    expect(classifyVehicleQuery("  244  ")).toEqual({ kind: "fleet-code", value: "244" });
  });

  it("não confunde número com letra junto (ex: chassi/placa) com código de frota", () => {
    expect(classifyVehicleQuery("2A34").kind).toBe("text");
    expect(classifyVehicleQuery("2-4").kind).toBe("text");
  });

  it("string vazia ou só espaço vira texto vazio, não código de frota", () => {
    expect(classifyVehicleQuery("").kind).toBe("text");
    expect(classifyVehicleQuery("   ").kind).toBe("text");
  });
});
