// Re-export temporário — o seletor foi generalizado para components/vehicles
// e passou a ser compartilhado (Pneus, Sinistro, Socorro). Remover este arquivo
// quando não houver mais imports apontando para o caminho antigo.
export { VehicleSearchSelect } from "@/components/vehicles/vehicle-search-select";
export type { VehicleOption, VehicleSearchSelectProps } from "@/components/vehicles/vehicle-search-select";
