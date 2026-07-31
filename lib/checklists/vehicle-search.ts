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

  const compactQuery = compact(query);
  return [vehicle.codigo_frota, vehicle.placa].some((value) => {
    const normalizedValue = normalize(value ?? "");
    return normalizedValue.includes(query) || (compactQuery !== "" && compact(normalizedValue).includes(compactQuery));
  });
}
