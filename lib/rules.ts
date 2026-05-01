export const THRESHOLDS = {
  idadeAtencao: 7,
  idadeCritico: 10,
  kmAtencao: 400_000,
  kmCritico: 600_000,
} as const;

export type StatusFrota = "disponivel" | "manutencao" | "atencao" | "critico" | "vendido";

export function calcularIdade(anoFabricacao: number | null, anoAtual: number = new Date().getFullYear()): number | null {
  if (anoFabricacao == null) return null;
  return anoAtual - anoFabricacao;
}

export function calcularStatus(idade: number | null, km: number | null): StatusFrota {
  const i = idade ?? 0;
  const k = km ?? 0;
  if (i > THRESHOLDS.idadeCritico || k > THRESHOLDS.kmCritico) return "critico";
  if (i > THRESHOLDS.idadeAtencao || k > THRESHOLDS.kmAtencao) return "atencao";
  return "disponivel";
}

export function parseVenda(localizacao: string | null): { vendido: boolean; anoVenda: number | null } {
  if (!localizacao) return { vendido: false, anoVenda: null };
  const m = localizacao.match(/^\s*venda(?:\s+(\d{4}))?/i);
  if (!m) return { vendido: false, anoVenda: null };
  const anoVenda = m[1] ? parseInt(m[1], 10) : null;
  return { vendido: true, anoVenda };
}
