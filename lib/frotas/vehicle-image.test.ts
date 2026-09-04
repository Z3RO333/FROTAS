import { describe, expect, it } from "vitest";
import { vehicleImage, vehicleShape } from "./vehicle-image";

describe("vehicleShape", () => {
  it("trata os modelos de carro da frota como carro", () => {
    expect(vehicleShape("VOLKSWAGEM POLO RECHE")).toBe("carro");
    expect(vehicleShape("POLO TRACK MA")).toBe("carro");
    expect(vehicleShape("POLO")).toBe("carro");
    expect(vehicleShape("GOL")).toBe("carro");
    expect(vehicleShape("ONIX - RECHE")).toBe("carro");
    expect(vehicleShape("BYD DOLPH MINI")).toBe("carro");
  });

  it("usa a foto de furgão nos utilitários leves", () => {
    expect(vehicleShape("FIORINO")).toBe("fiorino");
    expect(vehicleShape("FIORINO  ESCRITORIO DI RECHE")).toBe("fiorino");
    expect(vehicleShape("DOBLO 1.4")).toBe("fiorino");
    expect(vehicleShape("DUCATO/FIAT")).toBe("ducato");
    expect(vehicleShape("SPRINTER/M.BENZ")).toBe("ducato");
  });

  it("mantém caminhão para os modelos pesados e para modelo ausente", () => {
    expect(vehicleShape("ACCELO 815/ M. BENZ")).toBe("caminhao");
    expect(vehicleShape("ATEGO 1419/ M. BENZ")).toBe("caminhao");
    expect(vehicleShape("AXOR/ B. BENZ")).toBe("caminhao");
    expect(vehicleShape("VOLVO VM 330")).toBe("caminhao");
    expect(vehicleShape("HR/ HYUNDAI")).toBe("caminhao");
    expect(vehicleShape(null)).toBe("caminhao");
    expect(vehicleShape("   ")).toBe("caminhao");
  });

  it("ignora caixa e acentos", () => {
    expect(vehicleShape("polo track")).toBe("carro");
    expect(vehicleShape("Ônix Reche")).toBe("carro");
  });
});

describe("vehicleImage", () => {
  it("aponta para a arte correspondente", () => {
    expect(vehicleImage("VOLKSWAGEM POLO RECHE").src).toBe("/assets/carro.png");
    expect(vehicleImage("FIORINO").src).toBe("/assets/fiorino.png");
    expect(vehicleImage("DUCATO/FIAT").src).toBe("/assets/ducato.png");
    expect(vehicleImage("ACCELO 815/ M. BENZ").src).toBe("/assets/caminhao-bemol.png");
  });
});
