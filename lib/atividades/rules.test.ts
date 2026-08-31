import { describe, expect, it } from "vitest";
import {
  formatDuracao,
  requiresChecklistDoDia,
  requiresFotoNaConclusao,
} from "@/lib/atividades/rules";

describe("requiresFotoNaConclusao", () => {
  it("exige foto só para LEVAR_PARA", () => {
    expect(requiresFotoNaConclusao("LEVAR_PARA")).toBe(true);
    expect(requiresFotoNaConclusao("LIBERADA")).toBe(false);
    expect(requiresFotoNaConclusao("TESTE_PERCURSO")).toBe(false);
    expect(requiresFotoNaConclusao("OUTRO")).toBe(false);
  });
});

describe("requiresChecklistDoDia", () => {
  it("exige checklist do dia só para LEVAR_PARA", () => {
    expect(requiresChecklistDoDia("LEVAR_PARA")).toBe(true);
    expect(requiresChecklistDoDia("LIBERADA")).toBe(false);
    expect(requiresChecklistDoDia("TESTE_PERCURSO")).toBe(false);
    expect(requiresChecklistDoDia("OUTRO")).toBe(false);
  });
});

describe("formatDuracao", () => {
  it("formata minutos quando menor que uma hora", () => {
    const inicio = "2026-08-31T10:00:00.000Z";
    const fim = "2026-08-31T10:45:00.000Z";
    expect(formatDuracao(inicio, fim)).toBe("45min");
  });

  it("formata horas e minutos quando maior ou igual a uma hora", () => {
    const inicio = "2026-08-31T10:00:00.000Z";
    const fim = "2026-08-31T12:35:00.000Z";
    expect(formatDuracao(inicio, fim)).toBe("2h35min");
  });

  it("arredonda pra baixo até o minuto completo e nunca mostra negativo", () => {
    const inicio = "2026-08-31T10:00:00.000Z";
    const fim = "2026-08-31T10:00:40.000Z";
    expect(formatDuracao(inicio, fim)).toBe("0min");
  });
});
