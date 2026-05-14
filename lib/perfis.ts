export const PERFIS_USUARIO = ["MOTORISTA", "PORTARIA", "MANUTENCAO", "GESTOR", "ADMIN", "DEV"] as const;

export type PerfilUsuario = (typeof PERFIS_USUARIO)[number];

export const PERFIL_LABELS: Record<PerfilUsuario, string> = {
  MOTORISTA: "Motorista",
  PORTARIA: "Portaria",
  MANUTENCAO: "Manutencao",
  GESTOR: "Gestor",
  ADMIN: "Administrador",
  DEV: "Desenvolvedor",
};

export function isPerfilUsuario(value: unknown): value is PerfilUsuario {
  return typeof value === "string" && PERFIS_USUARIO.includes(value as PerfilUsuario);
}
