export type TipoLayoutPneus =
  | "utilitario_5"
  | "sprinter_6"
  | "simples_7"
  | "carreta_9"
  | "carreta_10"
  | "truck_11"
  | "bitruck_13";

export const TIPO_POR_QTD_PNEUS: Record<number, TipoLayoutPneus> = {
  5: "utilitario_5",
  6: "sprinter_6",
  7: "simples_7",
  9: "carreta_9",
  10: "carreta_10",
  11: "truck_11",
  13: "bitruck_13",
};

export const NOME_LAYOUT_PNEUS: Record<TipoLayoutPneus, string> = {
  utilitario_5: "Utilitário (5 pneus)",
  sprinter_6: "Sprinter / eixo duplo (6 pneus)",
  simples_7: "Caminhão simples (7 pneus)",
  carreta_9: "Carreta / chassi (9 pneus)",
  carreta_10: "Carreta pesada (10 pneus)",
  truck_11: "Caminhão truck (11 pneus)",
  bitruck_13: "Caminhão bitruck (13 pneus)",
};

export const DESCRICAO_POSICAO_PNEU: Record<string, string> = {
  de: "Dianteiro esquerdo",
  dd: "Dianteiro direito",
  te: "Traseiro esquerdo",
  td: "Traseiro direito",
  t1ei: "1º eixo traseiro interno esquerdo",
  t1ee: "1º eixo traseiro externo esquerdo",
  t1di: "1º eixo traseiro interno direito",
  t1de: "1º eixo traseiro externo direito",
  t2ei: "2º eixo traseiro interno esquerdo",
  t2ee: "2º eixo traseiro externo esquerdo",
  t2di: "2º eixo traseiro interno direito",
  t2de: "2º eixo traseiro externo direito",
  t3ei: "3º eixo traseiro interno esquerdo",
  t3ee: "3º eixo traseiro externo esquerdo",
  t3di: "3º eixo traseiro interno direito",
  t3de: "3º eixo traseiro externo direito",
  d1ei: "1º eixo duplo interno esquerdo",
  d1ee: "1º eixo duplo externo esquerdo",
  d1di: "1º eixo duplo interno direito",
  d1de: "1º eixo duplo externo direito",
  d2ei: "2º eixo duplo interno esquerdo",
  d2ee: "2º eixo duplo externo esquerdo",
  d2di: "2º eixo duplo interno direito",
  d2de: "2º eixo duplo externo direito",
  estepe: "Estepe",
};

export function getTipoLayoutPneus(qtdPneus: number | null | undefined): TipoLayoutPneus | null {
  const qtd = Number(qtdPneus ?? 0);
  return Number.isFinite(qtd) ? TIPO_POR_QTD_PNEUS[qtd] ?? null : null;
}
