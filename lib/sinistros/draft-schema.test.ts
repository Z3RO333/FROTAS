import { describe, expect, it } from "vitest";
import {
  buildSinistroDraft,
  hashEmail,
  isSinistroDraftExpired,
  sinistroDraftKey,
  sinistroDraftSchema,
  SINISTRO_DRAFT_TTL_MS,
} from "./draft-schema";

describe("hashEmail", () => {
  it("é determinístico para o mesmo e-mail", () => {
    expect(hashEmail("motorista@bemol.com.br")).toBe(hashEmail("motorista@bemol.com.br"));
  });

  it("não retorna o e-mail em texto puro", () => {
    expect(hashEmail("motorista@bemol.com.br")).not.toContain("motorista");
    expect(hashEmail("motorista@bemol.com.br")).not.toContain("@");
  });

  it("gera hashes diferentes pra e-mails diferentes", () => {
    expect(hashEmail("a@bemol.com.br")).not.toBe(hashEmail("b@bemol.com.br"));
  });
});

describe("sinistroDraftKey", () => {
  it("separa a chave por tipo — não mistura draft de veículo com o de socorro", () => {
    const veiculo = sinistroDraftKey("motorista@bemol.com.br", "veiculo");
    const socorro = sinistroDraftKey("motorista@bemol.com.br", "socorro");
    expect(veiculo).not.toBe(socorro);
    expect(veiculo).toContain(":veiculo");
    expect(socorro).toContain(":socorro");
  });

  it("separa a chave por usuário", () => {
    const a = sinistroDraftKey("a@bemol.com.br", "veiculo");
    const b = sinistroDraftKey("b@bemol.com.br", "veiculo");
    expect(a).not.toBe(b);
  });
});

describe("buildSinistroDraft", () => {
  it("carimba version e savedAt automaticamente", () => {
    const draft = buildSinistroDraft({
      submissionId: "550e8400-e29b-41d4-a716-446655440000",
      tipo: "veiculo",
      frotaId: 244,
      endereco: "Av. Djalma Batista, 1661",
      latitude: "-3.1019",
      longitude: "-60.0250",
      setor: "Operacao",
      descricao: "Colisão traseira",
    });
    expect(draft.version).toBe(1);
    expect(draft.savedAt).toBeGreaterThan(0);
    expect(sinistroDraftSchema.safeParse(draft).success).toBe(true);
  });
});

describe("isSinistroDraftExpired", () => {
  it("não expira um draft recém-salvo", () => {
    const draft = buildSinistroDraft({
      submissionId: "550e8400-e29b-41d4-a716-446655440000",
      tipo: "socorro",
      frotaId: null,
      endereco: "",
      latitude: "",
      longitude: "",
      setor: "",
      descricao: "",
    });
    expect(isSinistroDraftExpired(draft)).toBe(false);
  });

  it("expira um draft mais velho que o TTL", () => {
    const draft = buildSinistroDraft({
      submissionId: "550e8400-e29b-41d4-a716-446655440000",
      tipo: "socorro",
      frotaId: null,
      endereco: "",
      latitude: "",
      longitude: "",
      setor: "",
      descricao: "",
    });
    const future = draft.savedAt + SINISTRO_DRAFT_TTL_MS + 1;
    expect(isSinistroDraftExpired(draft, future)).toBe(true);
  });
});

describe("sinistroDraftSchema", () => {
  it("rejeita version diferente de 1 (rascunho de schema antigo)", () => {
    const result = sinistroDraftSchema.safeParse({
      version: 2,
      savedAt: Date.now(),
      submissionId: "550e8400-e29b-41d4-a716-446655440000",
      tipo: "veiculo",
      frotaId: null,
      endereco: "",
      latitude: "",
      longitude: "",
      setor: "",
      descricao: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita payload corrompido/incompleto", () => {
    expect(sinistroDraftSchema.safeParse({ lixo: true }).success).toBe(false);
  });

  it("nunca aceita campos de terceiros ou arquivos no draft", () => {
    const shape = sinistroDraftSchema.shape;
    expect(shape).not.toHaveProperty("terceiros");
    expect(shape).not.toHaveProperty("media");
    expect(shape).not.toHaveProperty("mediaPaths");
  });
});
