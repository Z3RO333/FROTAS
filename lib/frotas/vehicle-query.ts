// Classifica o texto digitado numa busca única de frota em duas estratégias:
// número de frota é igualdade exata (buscar "2" não pode trazer "20", "218"...);
// qualquer outra coisa (placa, chassi, modelo) é busca parcial.
// Ver plano de evolução de UX/navegação — "uma caixa visual, duas estratégias internas".

export type VehicleQueryClassification =
  | { kind: "fleet-code"; value: string }
  | { kind: "text"; value: string };

export function classifyVehicleQuery(raw: string): VehicleQueryClassification {
  const value = raw.trim();
  if (/^\d+$/.test(value)) return { kind: "fleet-code", value };
  return { kind: "text", value };
}
