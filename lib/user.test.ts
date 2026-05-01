import { describe, expect, it } from "vitest";
import { formatUserNameFromEmail, normalizeUserDisplayName } from "./user";

describe("formatUserNameFromEmail", () => {
  it("splits known Bemol compact first and last names", () => {
    expect(formatUserNameFromEmail("gustavoandrade@bemol.com.br")).toBe("Gustavo Andrade");
    expect(formatUserNameFromEmail("brendafonseca@bemol.com.br")).toBe("Brenda Fonseca");
    expect(formatUserNameFromEmail("ordensmanutencao@bemol.com.br")).toBe("Ordens Manutencao");
  });

  it("handles separated local parts", () => {
    expect(formatUserNameFromEmail("luciana.oliveira@bemol.com.br")).toBe("Luciana Oliveira");
    expect(formatUserNameFromEmail("walter-rodrigues@bemol.com.br")).toBe("Walter Rodrigues");
  });

  it("falls back to capitalizing a compact local part", () => {
    expect(formatUserNameFromEmail("jaceira@bemol.com.br")).toBe("Jaceira");
  });
});

describe("normalizeUserDisplayName", () => {
  it("prioritizes the name returned by Entra ID", () => {
    expect(normalizeUserDisplayName("gustavo andrade", "outro@bemol.com.br")).toBe("Gustavo Andrade");
  });

  it("uses email when the provider name is absent or email-like", () => {
    expect(normalizeUserDisplayName(null, "danieldamasceno@bemol.com.br")).toBe("Daniel Damasceno");
    expect(
      normalizeUserDisplayName("danieldamasceno@bemol.com.br", "danieldamasceno@bemol.com.br")
    ).toBe("Daniel Damasceno");
  });
});
