import { describe, expect, it } from "vitest";
import { safeReturnTo, withQuery } from "./search-state";

describe("withQuery", () => {
  it("adiciona/atualiza parâmetros preservando os existentes", () => {
    const current = new URLSearchParams("cd=Taruma");
    expect(withQuery("/frotas", current, { status: "manutencao" })).toBe(
      "/frotas?cd=Taruma&status=manutencao"
    );
  });

  it("remove o parâmetro quando o valor é null, undefined ou string vazia", () => {
    const current = new URLSearchParams("cd=Taruma&status=manutencao");
    expect(withQuery("/frotas", current, { status: null })).toBe("/frotas?cd=Taruma");
    expect(withQuery("/frotas", current, { status: undefined })).toBe("/frotas?cd=Taruma");
    expect(withQuery("/frotas", current, { status: "" })).toBe("/frotas?cd=Taruma");
  });

  it("retorna só o pathname quando não sobra nenhum parâmetro", () => {
    const current = new URLSearchParams("status=manutencao");
    expect(withQuery("/frotas", current, { status: null })).toBe("/frotas");
  });

  it("aceita números convertendo para string", () => {
    const current = new URLSearchParams();
    expect(withQuery("/frotas", current, { page: 2 })).toBe("/frotas?page=2");
  });
});

describe("safeReturnTo", () => {
  it("aceita caminhos relativos internos", () => {
    expect(safeReturnTo("/frotas?cd=Taruma")).toBe("/frotas?cd=Taruma");
    expect(safeReturnTo("/frotas/244")).toBe("/frotas/244");
  });

  it("rejeita valores ausentes ou vazios", () => {
    expect(safeReturnTo(null)).toBeNull();
    expect(safeReturnTo(undefined)).toBeNull();
    expect(safeReturnTo("")).toBeNull();
  });

  it("rejeita URLs absolutas e protocol-relative (open redirect)", () => {
    expect(safeReturnTo("https://evil.example")).toBeNull();
    expect(safeReturnTo("http://evil.example")).toBeNull();
    expect(safeReturnTo("//evil.example")).toBeNull();
  });

  it("rejeita caminhos que não começam com /", () => {
    expect(safeReturnTo("frotas/244")).toBeNull();
    expect(safeReturnTo("javascript:alert(1)")).toBeNull();
  });
});
