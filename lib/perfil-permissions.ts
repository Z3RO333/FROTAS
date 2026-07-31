import type { PerfilUsuario } from "@/lib/perfis";

export function canAccessPortaria(perfil: PerfilUsuario): boolean {
  return (
    perfil === "PORTARIA" ||
    perfil === "APROVADOR" ||
    perfil === "ADMIN" ||
    perfil === "GESTOR" ||
    perfil === "DEV"
  );
}

export function canApprovePortariaExit(perfil: PerfilUsuario): boolean {
  return perfil === "APROVADOR" || perfil === "GESTOR" || perfil === "ADMIN" || perfil === "DEV";
}

export function canAccessDocumentos(perfil: PerfilUsuario): boolean {
  return perfil !== "MOTORISTA" && perfil !== "APROVADOR";
}
