import { CDS_OPERACIONAIS } from "@/lib/cds";

export function normalizeCdNome(value: string | null | undefined): string {
  const cd = value?.trim();
  if (!cd) return "Sem CD";

  const withoutAccents = cd
    .replace(/[àáâãä]/gi, "a").replace(/[èéêë]/gi, "e").replace(/[ìíîï]/gi, "i")
    .replace(/[òóôõö]/gi, "o").replace(/[ùúûü]/gi, "u").replace(/[ç]/gi, "c")
    .replace(/[ñ]/gi, "n");
  const normalized = withoutAccents.replace(/\s+/g, " ").trim().toUpperCase();

  if (normalized === "CD TARUMA" || normalized === "CD TARUMA - AM" || normalized === "TARUMA" ||
      normalized.startsWith("CD TURISMO") || normalized === "CD FARMA" || normalized === "CD MERCADO") {
    return "CD Tarumã";
  }

  if (normalized.startsWith("MANUTENCAO")) return "Manutenção";

  if (
    normalized === "CD1" || normalized === "CD MANAUS" || normalized === "CD E-COMMERCE" ||
    normalized === "AM - MANAUS" ||
    normalized.startsWith("EXPEDICAO") || normalized.startsWith("EXPOSICAO") ||
    normalized.startsWith("ENTREGA INTERIOR") ||
    normalized === "ESCRITORIO" || normalized.startsWith("ESCRITORIO -") || normalized.startsWith("ESCRITORIO ") ||
    normalized.startsWith("INTERIOR -") || normalized.startsWith("LOJA COARI") ||
    normalized.startsWith("LOJA MAUES") ||
    ["BARREIRINHA","BOA VISTA DOS RAMOS","BORBA","COARI","CODAJAS","HUMAITA","JUTAI",
     "MANICORE","MAUES","NHAMUNDA","NOVA OLINDA DO NORTE","NOVO ARIPUANA","PARINTINS",
     "TEFE","URUCURITUBA","RAMPAP","E-COMMERCE","MARKETPLACE","SHIP FROM STORE",
     "ASSISTENCIA TECNICA","MERCADO","TABATINGA"].includes(normalized)
  ) { return "CD Manaus"; }

  if (normalized === "CD III" || normalized === "CD 3") {
    return "CD III";
  }
  if (normalized.startsWith("RO -") || normalized.includes("PORTO VELHO") ||
      normalized === "ARIQUEMES" || normalized.includes("JIPARANA")) {
    return "CD Porto Velho";
  }
  if (normalized.startsWith("AC -") || normalized.includes("RIO BRANCO") || normalized.includes("CRUZEIRO DO SUL")) {
    return "CD Rio Branco";
  }
  if (normalized.startsWith("RR -") || normalized.includes("BOA VISTA")) return "CD Boa Vista";
  if (normalized.startsWith("VENDA") || normalized.startsWith("VENDID") || normalized.startsWith("DESCARACTERIZAD")) return "Sem CD";
  return CDS_OPERACIONAIS.includes(cd as (typeof CDS_OPERACIONAIS)[number]) ? cd : "Sem CD";
}
