import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { reportCalendarDate } from "@/lib/report-date";
import { calculateDateSchedule, calculateKmSchedule, calendarDate } from "@/lib/maintenance-schedule";
import { SERVICO_CONFIG } from "./servicos";

export type ManutencaoStatusRow = {
  equipamento: string | null;
  placa: string | null;
  frota_numero: string | null;
  setor: string | null;
  tipo_servico: string;
  data_realizada: string | null;
  media_intervalo: number | null;
  desvio: number | null;
  status: "NO_PRAZO" | "VENCIDO" | "SEM_REGISTRO";
};

type VeiculoRow = {
  codigo_frota: string;
  placa: string | null;
  equipamento: string | null;
  local: string | null;
  km_atual: number | null;
  intervalo_alinhamento_km: number | null;
  intervalo_suspensao_km: number | null;
  intervalo_arcondicionado_dias: number | null;
  intervalo_tacografo_dias: number | null;
  intervalo_portas_rool_up_dias: number | null;
  intervalo_embreagem_dias: number | null;
  intervalo_motor_km: number | null;
};

type ServicoRow = {
  id_veiculo: string;
  tipo_servico: string;
  data_servico: string;
  quilometragem: number | null;
};

// Rótulo legado (mesmo usado quando a fonte era fact_manutencao_programada)
// pro tipo do catálogo de servicos_app. Lavagem tem tela/fonte própria
// (getLavagem) e balanceamento reaproveita o intervalo do alinhamento sem
// card dedicado — os dois ficam fora do Radar de Preventivas por isso.
const TIPO_SERVICO_LABEL: Record<string, string> = {
  "ar-condicionado": "AR_CONDICIONADO",
  alinhamento: "ALINHAMENTO",
  motor: "PREVENTIVA_MOTOR",
  embreagem: "EMBREAGEM",
  tacografo: "TACOGRAFO",
  portas_rool_up: "PORTA_ROOL_UP",
  suspensao: "SUSPENSAO",
};

// Caminho inverso — de volta pro tipo usado em servicos_app/registrar-servico
// (ex: pro botão "Registrar serviço" abrir o formulário certo a partir do
// rótulo mostrado na tela).
export const TIPO_SERVICO_APP: Record<string, string> = Object.fromEntries(
  Object.entries(TIPO_SERVICO_LABEL).map(([appType, label]) => [label, appType])
);

function intervalConfig(appType: string): { campo: keyof VeiculoRow; tipo: "km" | "dias"; padrao: number } | null {
  const cfg = SERVICO_CONFIG.find((s) => s.id === appType);
  if (!cfg) return null;
  return { campo: cfg.intervaloCampo as keyof VeiculoRow, tipo: cfg.intervaloTipo, padrao: cfg.intervaloPadrao };
}

async function fetchAllServicosApp(appTypes: string[]): Promise<ServicoRow[]> {
  const rows: ServicoRow[] = [];
  const chunkSize = 1000;
  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await supabaseManutencao
      .from("servicos_app")
      .select("id_veiculo,tipo_servico,data_servico,quilometragem")
      .in("tipo_servico", appTypes)
      .order("data_servico", { ascending: false })
      .range(from, from + chunkSize - 1);
    if (error) throw new Error(`getManutencaoStatus servicos_app: ${error.message}`);
    const chunk = (data ?? []) as ServicoRow[];
    rows.push(...chunk);
    if (chunk.length < chunkSize) break;
  }
  return rows;
}

/**
 * Status ao vivo de manutenção preventiva por frota × tipo de serviço, calculado
 * a partir do histórico real (servicos_app). Substitui a antiga leitura de
 * fact_manutencao_programada — uma tabela alimentada só por importação manual de
 * planilha, nunca corrigida por uso real do app (enviar/retirar da manutenção,
 * registrar serviço).
 *
 * Frotas sem nenhum serviço lançado pro tipo entram como SEM_REGISTRO — nunca
 * como VENCIDO, pra não repetir o falso-positivo em massa que a leitura de CRLV
 * teve ao tratar "sem dado" como "vencido".
 */
export async function getManutencaoStatus(tipoServico?: string): Promise<ManutencaoStatusRow[]> {
  const appTypes = Object.entries(TIPO_SERVICO_LABEL)
    .filter(([, label]) => !tipoServico || label === tipoServico)
    .map(([appType]) => appType);

  const [servicosApp, vehicleResult] = await Promise.all([
    fetchAllServicosApp(appTypes),
    supabaseManutencao
      .from("veiculos")
      .select(
        "codigo_frota,placa,equipamento,local,km_atual,intervalo_alinhamento_km,intervalo_suspensao_km,intervalo_arcondicionado_dias,intervalo_tacografo_dias,intervalo_portas_rool_up_dias,intervalo_embreagem_dias,intervalo_motor_km"
      )
      .eq("ativo", true)
      .eq("vendido", false),
  ]);
  if (vehicleResult.error) throw new Error(`getManutencaoStatus: ${vehicleResult.error.message}`);

  const vehicles = (vehicleResult.data ?? []) as VeiculoRow[];

  // servicosApp já vem ordenado por data desc — o primeiro visto por
  // (frota, tipo) é o mais recente.
  const latest = new Map<string, ServicoRow>();
  for (const service of servicosApp) {
    const key = `${service.id_veiculo}:${service.tipo_servico}`;
    if (!latest.has(key)) latest.set(key, service);
  }

  const today = reportCalendarDate();
  const rows: ManutencaoStatusRow[] = [];

  for (const vehicle of vehicles) {
    for (const appType of appTypes) {
      const config = intervalConfig(appType);
      if (!config) continue;
      const service = latest.get(`${vehicle.codigo_frota}:${appType}`);
      const interval = Number(vehicle[config.campo] ?? config.padrao);

      let status: ManutencaoStatusRow["status"] = "SEM_REGISTRO";
      let desvio: number | null = null;
      let dataRealizada: string | null = null;

      if (service) {
        dataRealizada = calendarDate(service.data_servico);
        if (config.tipo === "km") {
          const schedule = calculateKmSchedule(service.quilometragem, interval, vehicle.km_atual);
          status = schedule.status;
          desvio = schedule.status === "VENCIDO" ? -schedule.overdueKm : null;
        } else {
          const schedule = calculateDateSchedule(service.data_servico, interval, today);
          status = schedule.status;
          desvio = schedule.status === "VENCIDO" ? -schedule.overdueDays : null;
        }
      }

      rows.push({
        equipamento: vehicle.equipamento,
        placa: vehicle.placa,
        frota_numero: vehicle.codigo_frota,
        setor: vehicle.local,
        tipo_servico: TIPO_SERVICO_LABEL[appType],
        data_realizada: dataRealizada,
        media_intervalo: interval,
        desvio,
        status,
      });
    }
  }

  rows.sort(
    (a, b) =>
      a.tipo_servico.localeCompare(b.tipo_servico) || (a.frota_numero ?? "").localeCompare(b.frota_numero ?? "")
  );
  return rows;
}
