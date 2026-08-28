/**
 * Filtra por número de frota e placa com correspondência exata (não parcial):
 * digitar "2" não deve trazer "20", "218" etc., e uma placa incompleta não
 * deve trazer sugestões — mesmo critério usado na busca de frota em Veículos.
 */
export function filtrarFrotasPorNumeroEPlaca<T extends { frota_geral: string | null; placa: string | null }>(
  frotas: T[],
  frotaQuery: string,
  placaQuery: string
): T[] {
  const frota = frotaQuery.trim().toLowerCase();
  const placa = placaQuery.trim().toLowerCase();
  return frotas.filter((f) => {
    if (frota && String(f.frota_geral ?? "").toLowerCase() !== frota) return false;
    if (placa && String(f.placa ?? "").toLowerCase() !== placa) return false;
    return true;
  });
}
