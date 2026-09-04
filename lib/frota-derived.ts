import type { Frota } from "@/lib/repos/frotas";
import { THRESHOLDS, calcularIdade } from "@/lib/rules";

export type CondicaoFrota = "normal" | "atencao" | "critico";
export type StatusOperacional = "disponivel" | "manutencao" | "indisponivel" | "baixado";

export const CHECKLIST_COOLDOWN_MS = 0;

export function bloqueioChecklistRestanteMs(
  _ultimoChecklistEm: string | null | undefined,
  _agora = Date.now()
): number {
  void _agora;
  return 0;
}

export function frotaEmBloqueioChecklist(
  ultimoChecklistEm: string | null | undefined,
  agora = Date.now()
): boolean {
  return bloqueioChecklistRestanteMs(ultimoChecklistEm, agora) > 0;
}

export const CONDICAO_LABELS: Record<CondicaoFrota, string> = {
  normal: "Normal",
  atencao: "Atenção",
  critico: "Crítico",
};

export const STATUS_OPERACIONAL_LABELS: Record<StatusOperacional, string> = {
  disponivel: "Disponível",
  manutencao: "Em manutenção",
  indisponivel: "Indisponível",
  baixado: "Baixado",
};

export function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === "";
}

export function cadastroIncompleto(frota: Frota): boolean {
  return isBlank(frota.placa) || isBlank(frota.chassi) || frota.km_atual == null;
}

export function statusOperacional(frota: Frota): StatusOperacional {
  if (!frota.ativo || frota.vendido || frota.status === "vendido") return "baixado";
  if (frota.status === "manutencao") return "manutencao";
  if (frota.status === "critico") return "indisponivel";
  return "disponivel";
}

export function condicaoFrota(frota: Frota): CondicaoFrota {
  const idade = calcularIdade(frota.ano_fabricacao);

  if (frota.status === "critico" || (idade != null && idade >= THRESHOLDS.idadeCritico)) {
    return "critico";
  }

  if (
    frota.status === "atencao" ||
    frota.status === "manutencao" ||
    (idade != null && idade >= THRESHOLDS.idadeAtencao) ||
    cadastroIncompleto(frota)
  ) {
    return "atencao";
  }

  return "normal";
}

export function motivosAtencao(frota: Frota): string[] {
  const idade = calcularIdade(frota.ano_fabricacao);
  const motivos: string[] = [];

  if (idade != null && idade >= THRESHOLDS.idadeCritico) {
    motivos.push(`Frota com ${idade} anos`);
  } else if (idade != null && idade >= THRESHOLDS.idadeAtencao) {
    motivos.push(`Frota acima de ${THRESHOLDS.idadeAtencao} anos`);
  }

  if (frota.status === "critico") motivos.push("Status base marcado como crítico");
  if (frota.status === "atencao") motivos.push("Status base marcado como atenção");
  if (frota.status === "manutencao") motivos.push("Frota em manutenção");
  if (frota.km_atual == null) motivos.push("KM não informado");
  if (isBlank(frota.placa)) motivos.push("Placa não informada");
  if (isBlank(frota.chassi)) motivos.push("Chassi não informado");

  return motivos;
}

export function frotaTitle(frota: Frota): string {
  return frota.frota_geral || frota.placa || frota.chassi || `Frota #${frota.id}`;
}
