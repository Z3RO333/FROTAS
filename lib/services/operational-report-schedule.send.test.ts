import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-manutencao", () => ({
  supabaseManutencao: { from: vi.fn() },
}));

const getChecklistsRealizadosNoDia = vi.fn();
const getFrotasComSemChecklistNoDia = vi.fn();
const getPendenciasCriadasNoDiaPorFrota = vi.fn();
const getObservacoesCriadasNoDiaPorFrota = vi.fn();
const sendRelatorioOperacionalDiario = vi.fn();

vi.mock("@/lib/repos/relatorios", () => ({
  getChecklistsRealizadosNoDia: (...args: unknown[]) => getChecklistsRealizadosNoDia(...args),
  getFrotasComSemChecklistNoDia: (...args: unknown[]) => getFrotasComSemChecklistNoDia(...args),
  getPendenciasCriadasNoDiaPorFrota: (...args: unknown[]) => getPendenciasCriadasNoDiaPorFrota(...args),
  getObservacoesCriadasNoDiaPorFrota: (...args: unknown[]) => getObservacoesCriadasNoDiaPorFrota(...args),
}));
vi.mock("@/lib/email", () => ({
  sendRelatorioOperacionalDiario: (...args: unknown[]) => sendRelatorioOperacionalDiario(...args),
}));

import type { EmailSchedule } from "@/lib/repos/email-schedule";
import { sendOperationalScheduleReports } from "@/lib/services/operational-report-schedule";

function schedule(overrides: Partial<EmailSchedule> = {}): EmailSchedule {
  return {
    id: 4,
    nome: "Relatorio Diario de Frotas",
    tipo: "RELATORIO_OPERACIONAL_DIARIO",
    destinatarios: ["gestao@bemol.com.br"],
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
  } as EmailSchedule;
}

const frota = (id: number) => ({
  id,
  frota_geral: String(id),
  placa: `AAA${id}`,
  localizacao: "CD Tarumã",
  setor: "CD TURISMO",
  km_informado: null,
  total_checklists: 1,
});

beforeEach(() => {
  vi.clearAllMocks();
  sendRelatorioOperacionalDiario.mockResolvedValue({ ok: true });
  getChecklistsRealizadosNoDia.mockResolvedValue(0);
  getPendenciasCriadasNoDiaPorFrota.mockResolvedValue([]);
  getObservacoesCriadasNoDiaPorFrota.mockResolvedValue([]);
});

describe("sendOperationalScheduleReports — escopo de setor vazio", () => {
  it("não envia e-mail quando o setor configurado não corresponde a nenhuma frota", async () => {
    // Cenário real do relatório zerado de 01/09/2026: a agenda apontava para
    // "CD TURISMO/ FARMA", nome que não existe mais em veiculos.setor/local.
    getFrotasComSemChecklistNoDia.mockResolvedValue({ fizeram: [], naoFizeram: [] });

    const [result] = await sendOperationalScheduleReports({
      schedule: schedule({ setores_incluidos: ["CD TURISMO/ FARMA"] }),
      calendarDate: "2026-09-01",
      dataRef: new Date("2026-09-01T04:00:00Z"),
    });

    expect(sendRelatorioOperacionalDiario).not.toHaveBeenCalled();
    expect(result.enviado).toBe(false);
    expect(result.erro).toMatch(/CD TURISMO\/ FARMA/);
    expect(result.erro).toMatch(/nenhuma frota/i);
  });

  it("envia normalmente quando o setor tem frotas, mesmo sem checklists no dia", async () => {
    getFrotasComSemChecklistNoDia.mockResolvedValue({ fizeram: [], naoFizeram: [frota(110)] });

    const [result] = await sendOperationalScheduleReports({
      schedule: schedule({ setores_incluidos: ["CD TURISMO"] }),
      calendarDate: "2026-09-01",
      dataRef: new Date("2026-09-01T04:00:00Z"),
    });

    expect(sendRelatorioOperacionalDiario).toHaveBeenCalledTimes(1);
    expect(result.enviado).toBe(true);
    expect(result.erro).toBeNull();
  });

  it("continua enviando o relatório geral (sem setores) mesmo com a base vazia", async () => {
    getFrotasComSemChecklistNoDia.mockResolvedValue({ fizeram: [], naoFizeram: [] });

    const [result] = await sendOperationalScheduleReports({
      schedule: schedule(),
      calendarDate: "2026-09-01",
      dataRef: new Date("2026-09-01T04:00:00Z"),
    });

    expect(sendRelatorioOperacionalDiario).toHaveBeenCalledTimes(1);
    expect(result.enviado).toBe(true);
  });
});
