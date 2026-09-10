import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-manutencao", () => ({
  supabaseManutencao: { from: vi.fn() },
}));

import { describe, expect, it } from "vitest";
import {
  mapFrotaManutencao,
  asCdResumo,
  resumoTexto,
  buildDisponibilidadePorSetor,
  buildDisponibilidadePorModelo,
} from "@/lib/repos/disponibilidade";

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

// disponível: nem manutenção nem indisponível
function disponivelRow(overrides: Partial<Parameters<typeof mapFrotaManutencao>[0]> = {}) {
  return baseRow({ status: "disponivel", status_operacional: "EM_USO", ...overrides });
}

describe("buildDisponibilidadePorSetor", () => {
  it("agrupa por unidade + setor e soma total/em_manutencao corretamente", () => {
    const rows = [
      baseRow({ id: 1, local: "CD Manaus", setor: "E-COMMERCE" }), // manutenção
      disponivelRow({ id: 2, local: "CD Manaus", setor: "E-COMMERCE" }),
      disponivelRow({ id: 3, local: "CD Manaus", setor: "E-COMMERCE" }),
    ];

    const result = buildDisponibilidadePorSetor(rows);
    expect(result).toEqual([
      { cd_nome: "CD Manaus", setor: "E-COMMERCE", total: 3, em_manutencao: 1, percentual_disponibilidade: 67 },
    ]);
  });

  it("cai em 'Sem setor' quando o veículo não tem setor cadastrado", () => {
    const result = buildDisponibilidadePorSetor([disponivelRow({ local: "CD Manaus", setor: null })]);
    expect(result[0].setor).toBe("Sem setor");
  });

  it("não mistura grupos de setores com nomes parecidos entre unidades diferentes", () => {
    const rows = [
      disponivelRow({ id: 1, local: "CD Manaus", setor: "EXPEDIÇÃO" }),
      disponivelRow({ id: 2, local: "CD Tarumã", setor: "EXPEDIÇÃO" }),
    ];
    const result = buildDisponibilidadePorSetor(rows);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.total)).toEqual([1, 1]);
  });

  it("filtra por cdNome quando informado", () => {
    const rows = [
      disponivelRow({ id: 1, local: "CD Manaus", setor: "EXPEDIÇÃO" }),
      disponivelRow({ id: 2, local: "CD Tarumã", setor: "EXPEDIÇÃO" }),
    ];
    const result = buildDisponibilidadePorSetor(rows, "CD Manaus");
    expect(result).toEqual([
      { cd_nome: "CD Manaus", setor: "EXPEDIÇÃO", total: 1, em_manutencao: 0, percentual_disponibilidade: 100 },
    ]);
  });

  it("ordena por unidade e depois por setor", () => {
    const rows = [
      disponivelRow({ id: 1, local: "CD Tarumã", setor: "Z" }),
      disponivelRow({ id: 2, local: "CD Manaus", setor: "B" }),
      disponivelRow({ id: 3, local: "CD Manaus", setor: "A" }),
    ];
    const result = buildDisponibilidadePorSetor(rows);
    expect(result.map((r) => `${r.cd_nome}/${r.setor}`)).toEqual([
      "CD Manaus/A",
      "CD Manaus/B",
      "CD Tarumã/Z",
    ]);
  });
});

describe("buildDisponibilidadePorModelo", () => {
  it("agrupa por modelo e Disponível + Indisponível sempre fecha com o Total", () => {
    const rows = [
      baseRow({ id: 1, modelo: "ACCELO 815/ M. BENZ" }), // manutenção
      disponivelRow({ id: 2, modelo: "ACCELO 815/ M. BENZ" }),
      disponivelRow({ id: 3, modelo: "ACCELO 815/ M. BENZ" }),
    ];

    const result = buildDisponibilidadePorModelo(rows);
    expect(result).toEqual([
      { modelo: "ACCELO 815/ M. BENZ", disponiveis: 2, indisponiveis: 1, total: 3 },
    ]);
  });

  it("também conta status 'indisponivel'/'critico' como indisponível, não só manutenção", () => {
    const rows = [
      disponivelRow({ id: 1, modelo: "HR/ HYUNDAI" }),
      baseRow({ id: 2, modelo: "HR/ HYUNDAI", status: "indisponivel", status_operacional: null }),
    ];
    const result = buildDisponibilidadePorModelo(rows);
    expect(result).toEqual([{ modelo: "HR/ HYUNDAI", disponiveis: 1, indisponiveis: 1, total: 2 }]);
  });

  it("cai em 'Sem modelo' quando o veículo não tem modelo cadastrado", () => {
    const result = buildDisponibilidadePorModelo([disponivelRow({ modelo: null })]);
    expect(result[0].modelo).toBe("Sem modelo");
  });

  it("filtra por cdNome quando informado", () => {
    const rows = [
      disponivelRow({ id: 1, local: "CD Manaus", modelo: "GOL" }),
      disponivelRow({ id: 2, local: "CD Tarumã", modelo: "GOL" }),
    ];
    const result = buildDisponibilidadePorModelo(rows, "CD Manaus");
    expect(result).toEqual([{ modelo: "GOL", disponiveis: 1, indisponiveis: 0, total: 1 }]);
  });

  it("ordena alfabeticamente por modelo", () => {
    const rows = [
      disponivelRow({ id: 1, modelo: "VOLVO VM 330" }),
      disponivelRow({ id: 2, modelo: "ACCELO 815/ M. BENZ" }),
      disponivelRow({ id: 3, modelo: "HR/ HYUNDAI" }),
    ];
    const result = buildDisponibilidadePorModelo(rows);
    expect(result.map((r) => r.modelo)).toEqual(["ACCELO 815/ M. BENZ", "HR/ HYUNDAI", "VOLVO VM 330"]);
  });
});
