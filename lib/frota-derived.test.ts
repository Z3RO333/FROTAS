import { describe, expect, it } from "vitest";
import {
  bloqueioChecklistRestanteMs,
  frotaEmBloqueioChecklist,
  statusOperacional,
} from "@/lib/frota-derived";
import type { Frota } from "@/lib/repos/frotas";

function frota(overrides: Partial<Frota> = {}): Frota {
  return {
    id: 1,
    frota_geral: "2",
    placa: "PHZ-6J17",
    modelo: null,
    chassi: null,
    renavam: null,
    ano_fabricacao: null,
    localizacao: null,
    setor: null,
    km_atual: 20_000,
    qtd_pneus: null,
    status: "disponivel",
    observacoes: null,
    vendido: false,
    ano_venda: null,
    ativo: true,
    criado_em: null,
    atualizado_em: null,
    atualizado_por: null,
    km_origem: null,
    km_atualizado_em: null,
    km_validado: null,
    ultimo_checklist_id: null,
    ultimo_checklist_em: null,
    ultimo_motorista_id: null,
    ultimo_motorista_nome: null,
    ultimo_abastecimento_em: null,
    ultimo_abastecimento_litros: null,
    status_operacional: null,
    manutencao_motivo: null,
    manutencao_tipo: null,
    manutencao_oficina: null,
    manutencao_prev_retorno: null,
    manutencao_observacao: null,
    manutencao_iniciado_em: null,
    manutencao_iniciado_por: null,
    manutencao_bloqueia_checklist: null,
    combustivel_atual_nivel: null,
    combustivel_atualizado_em: null,
    combustivel_origem: null,
    arla_atual_nivel: null,
    arla_atualizado_em: null,
    arla_origem: null,
    ...overrides,
  };
}

describe("estado operacional da frota", () => {
  it("não exige entrada depois de uma saída registrada", () => {
    const atual = frota({ status_operacional: "SAIDA_REGISTRADA" });

    expect(statusOperacional(atual)).toBe("disponivel");
  });

  it("mantém uma frota liberada como disponível", () => {
    const atual = frota({ status_operacional: "LIBERADA" });

    expect(statusOperacional(atual)).toBe("disponivel");
  });
});

describe("bloqueio temporário após checklist", () => {
  const agora = Date.parse("2026-08-03T12:00:00.000Z");

  it("bloqueia durante os 30 minutos seguintes", () => {
    const checklistEm = "2026-08-03T11:45:00.000Z";

    expect(frotaEmBloqueioChecklist(checklistEm, agora)).toBe(true);
    expect(bloqueioChecklistRestanteMs(checklistEm, agora)).toBe(15 * 60 * 1000);
  });

  it("desbloqueia exatamente depois de 30 minutos", () => {
    const checklistEm = "2026-08-03T11:30:00.000Z";

    expect(frotaEmBloqueioChecklist(checklistEm, agora)).toBe(false);
    expect(bloqueioChecklistRestanteMs(checklistEm, agora)).toBe(0);
  });
});
