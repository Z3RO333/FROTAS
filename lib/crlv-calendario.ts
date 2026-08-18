// Calendário nacional de licenciamento (CONTRAN): o mês de vencimento do CRLV
// segue o final da placa — final 1 = janeiro, final 2 = fevereiro... final 9 =
// setembro, final 0 = outubro.
export function mesLicenciamentoPorPlaca(placa: string | null): number | null {
  const digitos = (placa ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  const ultimo = Number(digitos[digitos.length - 1]);
  if (Number.isNaN(ultimo)) return null;
  return ultimo === 0 ? 10 : ultimo;
}

const NOMES_MES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export type CicloCrlv = { texto: string; tone: "critico" | "atencao" | "neutro" };

// Quando ainda não temos a data de vencimento lida (CRLV pendente de revisão,
// por exemplo), o final da placa já indica em qual mês o veículo precisa
// renovar — dá pra avisar mesmo sem o documento ter sido confirmado.
export function cicloRenovacaoPorPlaca(placa: string | null, hoje: Date = new Date()): CicloCrlv | null {
  const mes = mesLicenciamentoPorPlaca(placa);
  if (mes == null) return null;

  const mesAtual = hoje.getMonth() + 1;
  if (mes === mesAtual) return { texto: "Renovar esse mês", tone: "atencao" };
  if (mes < mesAtual) return { texto: "Vencido pelo calendário", tone: "critico" };
  return { texto: `Renova em ${NOMES_MES[mes - 1]}`, tone: "neutro" };
}

// Último dia do mês de licenciamento (final de placa) no ano corrente — usada
// como estimativa de "dias até vencer" pra CRLVs sem data lida, pra alimentar
// os mesmos buckets (vence em 1/2 meses, vencido) que usam a data real.
export function diasAteRenovacaoEstimada(placa: string | null, hoje: Date = new Date()): number | null {
  const mes = mesLicenciamentoPorPlaca(placa);
  if (mes == null) return null;
  const ultimoDia = new Date(hoje.getFullYear(), mes, 0);
  return (ultimoDia.getTime() - hoje.getTime()) / 86400000;
}
