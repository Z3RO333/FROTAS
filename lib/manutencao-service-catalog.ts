import type { TipoServico } from "@/lib/repos/manutencao/types";

export type ServiceCatalogItem = {
  slug: string;
  type: TipoServico;
  label: string;
  description: string;
  intervalType: "km" | "days" | "none";
  intervalField?:
    | "intervalo_alinhamento_km"
    | "intervalo_suspensao_km"
    | "intervalo_arcondicionado_dias"
    | "intervalo_tacografo_dias"
    | "intervalo_portas_rool_up_dias"
    | "intervalo_embreagem_dias"
    | "intervalo_motor_km";
  defaultInterval?: number;
};

export const SERVICE_CATALOG: ServiceCatalogItem[] = [
  { slug: "alinhamento", type: "alinhamento", label: "Alinhamento", description: "Alinhamentos realizados e próxima quilometragem.", intervalType: "km", intervalField: "intervalo_alinhamento_km", defaultInterval: 10_000 },
  { slug: "balanceamento", type: "balanceamento", label: "Balanceamento", description: "Histórico de balanceamentos da frota.", intervalType: "km", intervalField: "intervalo_alinhamento_km", defaultInterval: 10_000 },
  { slug: "preventiva-motor", type: "motor", label: "Preventiva do motor", description: "Preventivas do motor e próxima quilometragem.", intervalType: "km", intervalField: "intervalo_motor_km", defaultInterval: 20_000 },
  { slug: "suspensao", type: "suspensao", label: "Suspensão", description: "Serviços preventivos de suspensão.", intervalType: "km", intervalField: "intervalo_suspensao_km", defaultInterval: 5_000 },
  { slug: "ar-condicionado", type: "ar-condicionado", label: "Ar-condicionado", description: "Preventivas do sistema de climatização.", intervalType: "days", intervalField: "intervalo_arcondicionado_dias", defaultInterval: 365 },
  { slug: "embreagem", type: "embreagem", label: "Embreagem", description: "Preventivas e intervenções de embreagem.", intervalType: "days", intervalField: "intervalo_embreagem_dias", defaultInterval: 365 },
  { slug: "porta-roll-up", type: "portas_rool_up", label: "Porta Roll-Up", description: "Manutenções preventivas das portas Roll-Up.", intervalType: "days", intervalField: "intervalo_portas_rool_up_dias", defaultInterval: 60 },
  { slug: "tacografo", type: "tacografo", label: "Tacógrafo", description: "Aferições e vencimentos de tacógrafo.", intervalType: "days", intervalField: "intervalo_tacografo_dias", defaultInterval: 730 },
];

export function getServiceCatalogItem(slug: string): ServiceCatalogItem | undefined {
  return SERVICE_CATALOG.find((item) => item.slug === slug);
}
