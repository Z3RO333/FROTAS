import { CDS_OPERACIONAIS } from "@/lib/cds";

export function normalizeCdNome(value: string | null | undefined): string {
  const cd = value?.trim();
  if (!cd) return "Sem CD";

  const normalized = cd
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  if (
    normalized === "CD TARUMA" ||
    normalized === "CD TARUMA - AM" ||
    normalized === "TARUMA"
  ) {
    return "CD Tarumã";
  }

  if (
    normalized === "CD1" ||
    normalized === "CD MANAUS" ||
    normalized === "CD E-COMMERCE" ||
    normalized === "AM - MANAUS" ||
    normalized === "EXPEDICAO" ||
    normalized === "EXPOSICAO" ||
    normalized === "ESCRITORIO" ||
    normalized.startsWith("ESCRITORIO -") ||
    normalized.startsWith("INTERIOR -") ||
    normalized.startsWith("LOJA COARI") ||
    normalized.startsWith("LOJA MAUES") ||
    [
      "BARREIRINHA", "BOA VISTA DOS RAMOS", "BORBA", "COARI",
      "CODAJAS", "HUMAITA", "JUTAI", "MANICORE", "MAUES",
      "NHAMUNDA", "NOVA OLINDA DO NORTE", "NOVO ARIPUANA",
      "PARINTINS", "TEFE", "URUCURITUBA",
      "RAMPAP", "E-COMMERCE", "MARKETPLACE", "SHIP FROM STORE",
      "ASSISTENCIA TECNICA", "MANUTENCAO", "MERCADO", "TABATINGA",
    ].includes(normalized)
  ) {
    return "CD Manaus";
  }

  if (
    normalized.startsWith("CD TURISMO") ||
    normalized === "CD FARMA" ||
    normalized === "CD MERCADO" ||
    normalized === "CD III" ||
    normalized === "CD 3"
  ) {
    return "CD III";
  }

  if (normalized.startsWith("RO -") || normalized.includes("PORTO VELHO")) {
    return "CD Porto Velho";
  }

  if (normalized.startsWith("AC -")) {
    return "CD Rio Branco";
  }

  if (normalized.startsWith("RR -") || normalized.includes("BOA VISTA")) {
    return "CD Boa Vista";
  }

  if (
    normalized.startsWith("VENDA") ||
    normalized.startsWith("VENDID") ||
    normalized.startsWith("DESCARACTERIZAD")
  ) {
    return "Sem CD";
  }

  return CDS_OPERACIONAIS.includes(cd as (typeof CDS_OPERACIONAIS)[number]) ? cd : "Sem CD";
}
