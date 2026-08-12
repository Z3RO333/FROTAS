import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-manutencao", () => ({
  supabaseManutencao: { from: vi.fn() },
}));

import { describe, expect, it } from "vitest";
import { mapFrotaManutencao, asCdResumo, resumoTexto } from "@/lib/repos/disponibilidade";

const AGORA = new Date("2026-08-12T12:00:00Z").getTime();

function baseRow(overrides: Partial<Parameters<typeof mapFrotaManutencao>[0]> = {}) {
  return {
    id: 1,
    codigo_frota: "246",
    placa: "QZM-1F71",
    modelo: "VUC",
    local: "CD Tarumã",
    status: "manutencao",
    status_operacional: "EM_MANUTENCAO",
    ativo: true,
    vendido: false,
    km_atualizado_em: null,
    ultimo_checklist_em: null,
    ultimo_motorista_nome: "Douglas Santos",
    manutencao_motivo: "HM - Pintura do Teto do Baú",
    manutencao_tipo: "CORRETIVA",
    manutencao_oficina: null,
    manutencao_destino: null,
    manutencao_destino_detalhe: null,
    manutencao_iniciado_em: "2026-08-03T00:00:00Z",
    manutencao_iniciado_por: null,
    manutencao_prev_retorno: "2026-08-10T00:00:00Z",
    setor: null as string | null,
    ...overrides,
  };
}

describe("mapFrotaManutencao", () => {
  it("uses setor when the vehicle has one cadastrado", () => {
    const row = baseRow({ setor: "CD TURISMO/ FARMA" });
    const result = mapFrotaManutencao(row, AGORA);
    expect(result.setor).toBe("CD TURISMO/ FARMA");
  });

  it("falls back to local (CD) when setor is null", () => {
    const row = baseRow({ setor: null, local: "CD Tarumã" });
    const result = mapFrotaManutencao(row, AGORA);
    expect(result.setor).toBe("CD Tarumã");
  });

  it("always reports status PENDENTE", () => {
    const row = baseRow();
    const result = mapFrotaManutencao(row, AGORA);
    expect(result.status).toBe("PENDENTE");
  });

  it("maps frota, placa, cd_nome and manutencao fields", () => {
    const row = baseRow();
    const result = mapFrotaManutencao(row, AGORA);
    expect(result.frota_geral).toBe("246");
    expect(result.placa).toBe("QZM-1F71");
    expect(result.cd_nome).toBe("CD Tarumã");
    expect(result.tipo).toBe("CORRETIVA");
    expect(result.motivo).toBe("HM - Pintura do Teto do Baú");
    expect(result.previsao_retorno).toBe("2026-08-10T00:00:00Z");
  });
});

describe("asCdResumo", () => {
  it("returns the same object when cd_nome is already present", () => {
    const resumo = {
      cd_nome: "CD Manaus",
      total: 10,
      disponiveis: 8,
      em_manutencao: 2,
      indisponiveis: 0,
      em_operacao: 5,
      paradas: 2,
      percentual_disponibilidade: 80,
      pontos_atencao: 1,
    };
    expect(asCdResumo(resumo, "Ignorado")).toEqual(resumo);
  });

  it("adds cd_nome when given a DisponibilidadeGeral", () => {
    const geral = {
      total: 10,
      disponiveis: 8,
      em_manutencao: 2,
      indisponiveis: 0,
      em_operacao: 5,
      paradas: 2,
      percentual_disponibilidade: 80,
      pontos_atencao: 1,
    };
    expect(asCdResumo(geral, "Todos os CDs")).toEqual({ cd_nome: "Todos os CDs", ...geral });
  });
});

describe("resumoTexto", () => {
  it("formats a one-line summary", () => {
    const cd = {
      cd_nome: "CD Manaus",
      total: 10,
      disponiveis: 8,
      em_manutencao: 2,
      indisponiveis: 0,
      em_operacao: 5,
      paradas: 2,
      percentual_disponibilidade: 80,
      pontos_atencao: 1,
    };
    expect(resumoTexto(cd)).toBe(
      "CD Manaus: 80% disponível, 8/10 frotas disponíveis, 2 em manutenção, 0 indisponíveis, 1 ponto(s) de atenção."
    );
  });
});
