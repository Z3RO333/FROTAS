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
      { setor: null, destinatarios: ["geral@bemol.com.br"] },
    ]);
  });

  it("vincula cada setor somente aos seus destinatários", () => {
    const result = getOperationalScheduleAudiences(schedule({
      setores_incluidos: ["EXPEDIÇÃO", "OFICINA"],
      destinatarios_por_setor: {
        "EXPEDIÇÃO": ["expedicao@bemol.com.br"],
        "OFICINA": ["oficina@bemol.com.br", "gestor@bemol.com.br"],
      },
    }));

    expect(result).toEqual([
      { setor: "EXPEDIÇÃO", destinatarios: ["expedicao@bemol.com.br"] },
      { setor: "OFICINA", destinatarios: ["oficina@bemol.com.br", "gestor@bemol.com.br"] },
    ]);
  });

  it("preserva destinatários gerais em agendas setorizadas antigas", () => {
    expect(getOperationalScheduleAudiences(schedule({
      setores_incluidos: ["TRANSPORTE"],
      destinatarios_por_setor: {},
    }))).toEqual([
      { setor: "TRANSPORTE", destinatarios: ["geral@bemol.com.br"] },
    ]);
  });
});
