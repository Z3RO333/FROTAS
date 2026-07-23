import { describe, expect, it } from "vitest";
import {
  canAccessDocumentos,
  canAccessPortaria,
  canApprovePortariaExit,
} from "@/lib/perfil-permissions";

describe("permissões do aprovador da portaria", () => {
  it("permite que APROVADOR acesse a portaria e aprove uma exceção", () => {
    expect(canAccessPortaria("APROVADOR")).toBe(true);
    expect(canApprovePortariaExit("APROVADOR")).toBe(true);
  });

  it("mantém PORTARIA sem permissão de aprovação", () => {
    expect(canAccessPortaria("PORTARIA")).toBe(true);
    expect(canApprovePortariaExit("PORTARIA")).toBe(false);
  });

  it("permite que GESTOR registre movimentações, mas não aprove exceções", () => {
    expect(canAccessPortaria("GESTOR")).toBe(true);
    expect(canApprovePortariaExit("GESTOR")).toBe(false);
  });

  it("não concede módulos administrativos ao APROVADOR", () => {
    expect(canAccessDocumentos("APROVADOR")).toBe(false);
  });
});
