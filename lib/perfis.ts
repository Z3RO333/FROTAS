export const PERFIS_USUARIO = [
  "MOTORISTA",
  "MOTORISTA_INTERNO",
  "PORTARIA",
  "APROVADOR",
  "MANUTENCAO",
  "GESTOR",
  "ADMIN",
  "DEV",
] as const;

export type PerfilUsuario = (typeof PERFIS_USUARIO)[number];

export const PERFIL_LABELS: Record<PerfilUsuario, string> = {
  MOTORISTA: "Motorista",
  MOTORISTA_INTERNO: "Motorista interno",
  PORTARIA: "Portaria",
  APROVADOR: "Aprovador de saída",
  MANUTENCAO: "Manutencao",
  GESTOR: "Gestor",
  ADMIN: "Administrador",
  DEV: "Desenvolvedor",
};

export function isPerfilUsuario(value: unknown): value is PerfilUsuario {
  return typeof value === "string" && PERFIS_USUARIO.includes(value as PerfilUsuario);
}
