export const CDS_OPERACIONAIS = [
  "CD Tarumã",
  "CD Manaus",
  "CD III",
  "CD Porto Velho",
  "CD Rio Branco",
  "CD Boa Vista",
] as const;

export type CdOperacional = (typeof CDS_OPERACIONAIS)[number];
