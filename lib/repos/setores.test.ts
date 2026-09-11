import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-manutencao", () => ({
  supabaseManutencao: { from: vi.fn() },
}));

import { describe, expect, it } from "vitest";
import { mergeDestinatariosPorSetor, mergeSetorArray } from "@/lib/repos/setores";

describe("mergeSetorArray", () => {
  it("funde o setor antigo no novo quando o novo já está na lista, sem duplicar", () => {
    const resultado = mergeSetorArray(
      ["ASSISTENCIA TECNICA", "ASSISTENCIA TÉCNICA", "E-COMMERCE"],
      "ASSISTENCIA TECNICA",
      "ASSISTENCIA TÉCNICA"
    );
    expect(resultado).toEqual(["ASSISTENCIA TÉCNICA", "E-COMMERCE"]);
  });

  it("renomeia para um nome que ainda não existe na lista", () => {
    const resultado = mergeSetorArray(["CD TURISMO", "E-COMMERCE"], "CD TURISMO", "CD Tarumã");
    expect(resultado).toEqual(["CD Tarumã", "E-COMMERCE"]);
  });

  it("remove a entrada quando o novo nome é null (apagar)", () => {
    const resultado = mergeSetorArray(["CD TURISMO", "E-COMMERCE"], "CD TURISMO", null);
    expect(resultado).toEqual(["E-COMMERCE"]);
  });

  it("não mexe na lista quando o setor não está presente", () => {
    const resultado = mergeSetorArray(["E-COMMERCE"], "RAMPAP", "OUTRO");
    expect(resultado).toEqual(["E-COMMERCE"]);
  });
});

describe("mergeDestinatariosPorSetor", () => {
  it("soma os destinatários do setor antigo aos do setor de destino, sem duplicar", () => {
    const resultado = mergeDestinatariosPorSetor(
      {
        "ASSISTENCIA TECNICA": ["manutencaocd@bemol.com.br"],
        "ASSISTENCIA TÉCNICA": ["manutencaocd@bemol.com.br"],
        "E-COMMERCE": ["outro@bemol.com.br"],
      },
      "ASSISTENCIA TECNICA",
      "ASSISTENCIA TÉCNICA"
    );
    expect(resultado).toEqual({
      "ASSISTENCIA TÉCNICA": ["manutencaocd@bemol.com.br"],
      "E-COMMERCE": ["outro@bemol.com.br"],
    });
  });

  it("junta destinatários diferentes ao fundir dois setores com e-mails distintos", () => {
    const resultado = mergeDestinatariosPorSetor(
      { A: ["a@bemol.com.br"], B: ["b@bemol.com.br"] },
      "A",
      "B"
    );
    expect(resultado.B.sort()).toEqual(["a@bemol.com.br", "b@bemol.com.br"]);
    expect(resultado.A).toBeUndefined();
  });

  it("renomeia a chave quando o setor de destino não tinha destinatários próprios", () => {
    const resultado = mergeDestinatariosPorSetor(
      { "CD TURISMO": ["gestao@bemol.com.br"] },
      "CD TURISMO",
      "CD Tarumã"
    );
    expect(resultado).toEqual({ "CD Tarumã": ["gestao@bemol.com.br"] });
  });

  it("remove a chave quando o novo nome é null (apagar)", () => {
    const resultado = mergeDestinatariosPorSetor({ "CD TURISMO": ["gestao@bemol.com.br"] }, "CD TURISMO", null);
    expect(resultado).toEqual({});
  });

  it("não cria entrada pro setor de destino quando o antigo não tinha destinatários vinculados", () => {
    const resultado = mergeDestinatariosPorSetor({ B: ["b@bemol.com.br"] }, "A", "B");
    expect(resultado).toEqual({ B: ["b@bemol.com.br"] });
  });
});
