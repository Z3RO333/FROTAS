import { describe, expect, it } from "vitest";
import type { EmailSchedule } from "@/lib/repos/email-schedule";
import { getOperationalScheduleAudiences } from "@/lib/email-schedule-audiences";

function schedule(overrides: Partial<EmailSchedule> = {}): EmailSchedule {
  return {
    id: 1,
    nome: "Checklist diário",
    tipo: "RELATORIO_OPERACIONAL_DIARIO",
    destinatarios: ["geral@bemol.com.br"],
    frequencia: "DIARIO",
    dia_semana: null,
    dia_mes: null,
    hora_envio: "07:00",
    cds_incluidos: [],
    setores_incluidos: [],
    destinatarios_por_setor: {},
    ativo: true,
    ultimo_envio: null,
    proximo_envio: null,
    criado_por: null,
    criado_em: "2026-08-11T00:00:00.000Z",
    processing_token: null,
    processing_started_at: null,
    ...overrides,
  };
}

describe("getOperationalScheduleAudiences", () => {
  it("mantém um envio geral quando não há setores", () => {
    expect(getOperationalScheduleAudiences(schedule())).toEqual([
      { setores: null, destinatarios: ["geral@bemol.com.br"] },
    ]);
  });

  it("agrupa setores com destinatários diferentes em envios separados", () => {
    const result = getOperationalScheduleAudiences(schedule({
      setores_incluidos: ["EXPEDIÇÃO", "OFICINA"],
      destinatarios_por_setor: {
        "EXPEDIÇÃO": ["expedicao@bemol.com.br"],
        "OFICINA": ["oficina@bemol.com.br", "gestor@bemol.com.br"],
      },
    }));

    expect(result).toEqual([
      { setores: ["EXPEDIÇÃO"], destinatarios: ["expedicao@bemol.com.br"] },
      { setores: ["OFICINA"], destinatarios: ["oficina@bemol.com.br", "gestor@bemol.com.br"] },
    ]);
  });

  it("consolida setores que compartilham exatamente os mesmos destinatários em 1 único envio", () => {
    const result = getOperationalScheduleAudiences(schedule({
      setores_incluidos: ["SETOR A", "SETOR B", "SETOR C"],
      destinatarios_por_setor: {
        "SETOR A": ["gestor@bemol.com.br", "manutencao@bemol.com.br"],
        "SETOR B": ["manutencao@bemol.com.br", "gestor@bemol.com.br"],
        "SETOR C": ["gestor@bemol.com.br", "manutencao@bemol.com.br"],
      },
    }));

    expect(result).toEqual([
      {
        setores: ["SETOR A", "SETOR B", "SETOR C"],
        destinatarios: ["gestor@bemol.com.br", "manutencao@bemol.com.br"],
      },
    ]);
  });

  it("mistura grupos consolidados e grupos separados quando destinatários divergem parcialmente", () => {
    const result = getOperationalScheduleAudiences(schedule({
      setores_incluidos: ["SETOR A", "SETOR B", "SETOR C"],
      destinatarios_por_setor: {
        "SETOR A": ["gestor@bemol.com.br"],
        "SETOR B": ["gestor@bemol.com.br"],
        "SETOR C": ["outro@bemol.com.br"],
      },
    }));

    expect(result).toEqual([
      { setores: ["SETOR A", "SETOR B"], destinatarios: ["gestor@bemol.com.br"] },
      { setores: ["SETOR C"], destinatarios: ["outro@bemol.com.br"] },
    ]);
  });

  it("preserva destinatários gerais em agendas setorizadas antigas", () => {
    expect(getOperationalScheduleAudiences(schedule({
      setores_incluidos: ["TRANSPORTE"],
      destinatarios_por_setor: {},
    }))).toEqual([
      { setores: ["TRANSPORTE"], destinatarios: ["geral@bemol.com.br"] },
    ]);
  });

  it("agrupa setores legados sem override, que caem todos nos destinatários gerais", () => {
    expect(getOperationalScheduleAudiences(schedule({
      setores_incluidos: ["TRANSPORTE", "OFICINA"],
      destinatarios_por_setor: {},
    }))).toEqual([
      { setores: ["TRANSPORTE", "OFICINA"], destinatarios: ["geral@bemol.com.br"] },
    ]);
  });
});
