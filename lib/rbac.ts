import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { normalizeUserDisplayName } from "@/lib/user";

export type PerfilUsuario = "MOTORISTA" | "PORTARIA" | "ADMIN" | "MANUTENCAO" | "GESTOR" | "DEV";

export type AppUser = {
  email: string;
  name: string;
  perfil: PerfilUsuario;
};

const ADMIN_EMAILS = parseList(process.env.FROTAS_ADMIN_EMAILS);
const DEV_EMAILS = parseList(`gustavoandrade@bemol.com.br,${process.env.FROTAS_DEV_EMAILS ?? ""}`);
const DRIVER_EMAILS = parseList(process.env.FROTAS_DRIVER_EMAILS);
const PORTARIA_EMAILS = parseList(process.env.FROTAS_PORTARIA_EMAILS);
const MAINTENANCE_EMAILS = parseList(process.env.FROTAS_MANUTENCAO_EMAILS);
const MANAGER_EMAILS = parseList(process.env.FROTAS_GESTOR_EMAILS);

function parseList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function hasEmail(set: Set<string>, email: string): boolean {
  return set.has("*") || set.has(email.toLowerCase());
}

export function resolvePerfil(email: string): PerfilUsuario {
  const normalized = email.toLowerCase();

  if (hasEmail(DEV_EMAILS, normalized)) return "DEV";
  if (hasEmail(ADMIN_EMAILS, normalized)) return "ADMIN";
  if (hasEmail(MANAGER_EMAILS, normalized)) return "GESTOR";
  if (hasEmail(MAINTENANCE_EMAILS, normalized)) return "MANUTENCAO";
  if (hasEmail(PORTARIA_EMAILS, normalized)) return "PORTARIA";
  if (hasEmail(DRIVER_EMAILS, normalized)) return "MOTORISTA";

  const fallback = (process.env.FROTAS_DEFAULT_PROFILE ?? "").toUpperCase();
  if (
    fallback === "MOTORISTA" ||
    fallback === "PORTARIA" ||
    fallback === "MANUTENCAO" ||
    fallback === "GESTOR" ||
    fallback === "DEV"
  ) {
    return fallback;
  }

  return "MOTORISTA";
}

export function canAccessAdmin(perfil: PerfilUsuario): boolean {
  return perfil === "ADMIN" || perfil === "GESTOR" || perfil === "MANUTENCAO" || perfil === "DEV";
}

export function canAccessPortaria(perfil: PerfilUsuario): boolean {
  return perfil === "PORTARIA" || perfil === "ADMIN" || perfil === "GESTOR" || perfil === "DEV";
}

export function canAccessMotorista(perfil: PerfilUsuario): boolean {
  return perfil === "MOTORISTA" || perfil === "ADMIN" || perfil === "GESTOR" || perfil === "DEV";
}

export async function requireAppUser(): Promise<AppUser> {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  return {
    email: session.user.email,
    name: normalizeUserDisplayName(session.user.name, session.user.email),
    perfil: resolvePerfil(session.user.email),
  };
}

export async function requireAdminUser(): Promise<AppUser> {
  const user = await requireAppUser();
  if (!canAccessAdmin(user.perfil)) redirect(user.perfil === "PORTARIA" ? "/portaria" : "/motorista");
  return user;
}

export async function requirePortariaUser(): Promise<AppUser> {
  const user = await requireAppUser();
  if (!canAccessPortaria(user.perfil)) redirect(user.perfil === "MOTORISTA" ? "/motorista" : "/");
  return user;
}

export async function requireMotoristaUser(): Promise<AppUser> {
  const user = await requireAppUser();
  if (!canAccessMotorista(user.perfil)) redirect(user.perfil === "PORTARIA" ? "/portaria" : "/");
  return user;
}

export function canAccessManutencao(perfil: PerfilUsuario): boolean {
  return perfil === "ADMIN" || perfil === "GESTOR" || perfil === "MANUTENCAO" || perfil === "DEV";
}

export function canAccessOperacao(perfil: PerfilUsuario): boolean {
  return perfil === "ADMIN" || perfil === "GESTOR" || perfil === "PORTARIA" || perfil === "DEV";
}

export function canAccessDocumentos(perfil: PerfilUsuario): boolean {
  return perfil !== "MOTORISTA";
}

export function canWriteDocumentos(perfil: PerfilUsuario): boolean {
  return perfil === "ADMIN" || perfil === "GESTOR" || perfil === "MANUTENCAO" || perfil === "DEV";
}
