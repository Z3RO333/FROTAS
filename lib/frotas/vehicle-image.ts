/**
 * Escolhe a arte do veículo a partir do modelo cadastrado.
 *
 * A frota tem carros de passeio (Polo, Gol, Onix...) e utilitários leves
 * (Fiorino, Ducato, Sprinter...) além dos caminhões. Mostrar o caminhão Bemol
 * para um Polo deixava a ficha errada, então cada grupo usa a sua foto.
 */
export type VehicleShape = "carro" | "fiorino" | "ducato" | "caminhao";

type Rule = { shape: VehicleShape; terms: string[] };

// Ordem importa: o primeiro termo encontrado no modelo define a arte.
const RULES: Rule[] = [
  {
    shape: "carro",
    terms: [
      "POLO",
      "GOL",
      "ONIX",
      "DOLPH", // BYD Dolphin Mini
      "PRISMA",
      "VOYAGE",
      "SIENA",
      "ARGO",
      "MOBI",
      "KWID",
      "HB20",
      "SANDERO",
      "COROLLA",
      "CIVIC",
      "CRONOS",
      "VIRTUS",
      "TRACKER",
      "T-CROSS",
      "TCROSS",
      "COMPASS",
      "RENEGADE",
      "DUSTER",
      "ECOSPORT",
    ],
  },
  {
    // Furgões grandes: Ducato e Sprinter têm o mesmo porte.
    shape: "ducato",
    terms: ["DUCATO", "SPRINTER", "MASTER", "JUMPER", "DAILY", "TRANSIT"],
  },
  {
    // Furgões compactos.
    shape: "fiorino",
    terms: ["FIORINO", "DOBLO", "KANGOO", "PARTNER", "COMBO"],
  },
];

export function normalizeModelo(modelo: string | null | undefined): string {
  return (modelo ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

/** Classifica o modelo em carro, furgão ou caminhão (padrão da frota). */
export function vehicleShape(modelo: string | null | undefined): VehicleShape {
  const texto = normalizeModelo(modelo);
  if (!texto) return "caminhao";

  for (const rule of RULES) {
    if (rule.terms.some((term) => texto.includes(term))) return rule.shape;
  }
  return "caminhao";
}

const IMAGES: Record<VehicleShape, { src: string; alt: string; width: number; height: number }> = {
  carro: { src: "/assets/carro.png", alt: "Carro da frota Bemol", width: 396, height: 182 },
  fiorino: { src: "/assets/fiorino.png", alt: "Furgão compacto da frota Bemol", width: 396, height: 296 },
  ducato: { src: "/assets/ducato.png", alt: "Furgão da frota Bemol", width: 396, height: 255 },
  caminhao: { src: "/assets/caminhao-bemol.png", alt: "Caminhão Bemol", width: 396, height: 247 },
};

export function vehicleImage(modelo: string | null | undefined) {
  return IMAGES[vehicleShape(modelo)];
}
