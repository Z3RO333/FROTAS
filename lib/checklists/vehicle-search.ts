type SearchableVehicle = {
  codigo_frota?: string | null;
  placa?: string | null;
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function compact(value: string): string {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

export function matchesVehicleSearch(vehicle: SearchableVehicle, search: string): boolean {
  const query = normalize(search);
  if (!query) return true;

  const isNumericOnly = /^\d+$/.test(query);

  if (isNumericOnly) {
    // Busca por frota: exata (ex.: "11" não bate em "111" ou "115")
    return normalize(vehicle.codigo_frota ?? "") === query;
  }

  // Busca por placa: parcial sem separadores (ex.: "TRZ" bate em "TRZ-8G44")
  const compactQuery = compact(query);
  const compactPlaca = compact(normalize(vehicle.placa ?? ""));
  return compactPlaca.includes(compactQuery);
}
