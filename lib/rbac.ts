import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PERFIS_USUARIO, isPerfilUsuario, type PerfilUsuario } from "@/lib/perfis";
import { ensureUsuarioForAccess } from "@/lib/repos/usuarios";
import { normalizeUserDisplayName } from "@/lib/user";
import { canAccessPortaria } from "@/lib/perfil-permissions";

export {
  canAccessDocumentos,
  canAccessPortaria,
  canApprovePortariaExit,
} from "@/lib/perfil-permissions";

export type { PerfilUsuario } from "@/lib/perfis";

export type AppUser = {
  email: string;
  name: string;
  perfil: PerfilUsuario;
};

const ADMIN_EMAILS = parseList(process.env.FROTAS_ADMIN_EMAILS);
const DEV_EMAILS = parseList(process.env.FROTAS_DEV_EMAILS ?? "");
const DRIVER_EMAILS = parseList(process.env.FROTAS_DRIVER_EMAILS);
const PORTARIA_EMAILS = parseList(process.env.FROTAS_PORTARIA_EMAILS);
const APPROVER_EMAILS = parseList(process.env.FROTAS_APROVADOR_EMAILS);
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
  return set.has(email.toLowerCase());
}

export function resolvePerfilFromEnv(email: string): PerfilUsuario {
  const normalized = email.toLowerCase();

  // Em produção, o perfil DEV não existe — cai para ADMIN para não bloquear acesso
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd && hasEmail(DEV_EMAILS, normalized)) return "DEV";
  if (hasEmail(ADMIN_EMAILS, normalized)) return "ADMIN";
  if (hasEmail(APPROVER_EMAILS, normalized)) return "APROVADOR";
  if (hasEmail(MANAGER_EMAILS, normalized)) return "GESTOR";
  if (hasEmail(MAINTENANCE_EMAILS, normalized)) return "MANUTENCAO";
  if (hasEmail(PORTARIA_EMAILS, normalized)) return "PORTARIA";
  if (hasEmail(DRIVER_EMAILS, normalized)) return "MOTORISTA";

  const fallback = (process.env.FROTAS_DEFAULT_PROFILE ?? "").toUpperCase();
  if (isPerfilUsuario(fallback) && fallback !== "ADMIN") {
    return fallback;
  }

  return "MOTORISTA";
}

export function resolvePerfil(email: string): PerfilUsuario {
  return resolvePerfilFromEnv(email);
}

export function canAccessAdmin(perfil: PerfilUsuario): boolean {
  return perfil === "ADMIN" || perfil === "GESTOR" || perfil === "MANUTENCAO" || perfil === "DEV";
}

function redirectForOperationalProfile(perfil: PerfilUsuario): string {
  if (perfil === "PORTARIA" || perfil === "APROVADOR") return "/portaria";
  if (perfil === "MOTORISTA") return "/motorista";
  return "/";
}

export function canAccessMotorista(perfil: PerfilUsuario): boolean {
  return perfil === "MOTORISTA" || perfil === "ADMIN" || perfil === "GESTOR" || perfil === "DEV";
}

export type AppUserResolution =
  | { ok: true; user: AppUser }
  | { ok: false; reason: "UNAUTHENTICATED" | "INACTIVE" };

export async function resolveAppUser(): Promise<AppUserResolution> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, reason: "UNAUTHENTICATED" };

  const email = session.user.email.toLowerCase();
  const name = normalizeUserDisplayName(session.user.name, email);
  const usuario = await ensureUsuarioForAccess({
    email,
    nome: name,
    perfil: resolvePerfilFromEnv(email),
    // O signIn callback (lib/auth.ts) já restringe o login ao domínio corporativo
    // via Entra ID, então toda conta que chega aqui já é legítima. Perfil cai em
    // MOTORISTA por padrão (resolvePerfilFromEnv) e o gestor promove depois pela
    // tela de administração de usuários.
    ativo: true,
  });

  if (!usuario.ativo) return { ok: false, reason: "INACTIVE" };

  return {
    ok: true,
    user: {
      email,
      name: usuario.nome || name,
      // Segunda trava, independente da tela de administração: contas TERCEIRO nunca
      // carregam um perfil acima de MOTORISTA pra sessão, mesmo que o registro no
      // banco esteja inconsistente por algum motivo.
      perfil: usuario.tipo_conta === "TERCEIRO" ? "MOTORISTA" : usuario.perfil,
    },
  };
}

export const requireAppUser = cache(async (): Promise<AppUser> => {
  const result = await resolveAppUser();
  if (!result.ok) {
    redirect(result.reason === "INACTIVE" ? "/acesso-bloqueado" : "/login");
  }
  return result.user;
});

export async function requireAdminUser(): Promise<AppUser> {
  const user = await requireAppUser();
  if (!canAccessAdmin(user.perfil)) redirect(redirectForOperationalProfile(user.perfil));
  return user;
}

export async function requirePortariaUser(): Promise<AppUser> {
  const user = await requireAppUser();
  if (!canAccessPortaria(user.perfil)) redirect(redirectForOperationalProfile(user.perfil));
  return user;
}

export async function requireMotoristaUser(): Promise<AppUser> {
  const user = await requireAppUser();
  if (!canAccessMotorista(user.perfil)) redirect(redirectForOperationalProfile(user.perfil));
  return user;
}

export function canAccessManutencao(perfil: PerfilUsuario): boolean {
  return perfil === "ADMIN" || perfil === "GESTOR" || perfil === "MANUTENCAO" || perfil === "DEV";
}

export function canAccessOperacao(perfil: PerfilUsuario): boolean {
  return perfil === "ADMIN" || perfil === "GESTOR" || perfil === "PORTARIA" || perfil === "DEV";
}

export function canWriteDocumentos(perfil: PerfilUsuario): boolean {
  return perfil === "ADMIN" || perfil === "GESTOR" || perfil === "MANUTENCAO" || perfil === "DEV";
}

export function canManageUsers(perfil: PerfilUsuario): boolean {
  return perfil === "ADMIN" || perfil === "DEV";
}

export function canManageEmailSchedules(perfil: PerfilUsuario): boolean {
  return perfil === "ADMIN" || perfil === "GESTOR" || perfil === "DEV";
}

export function canEditFrota(perfil: PerfilUsuario): boolean {
  return perfil === "ADMIN" || perfil === "GESTOR" || perfil === "DEV";
}

export async function requireGestorUser(): Promise<AppUser> {
  const user = await requireAppUser();
  if (!canEditFrota(user.perfil)) {
    redirect(redirectForOperationalProfile(user.perfil));
  }
  return user;
}

export async function requireManutencaoUser(): Promise<AppUser> {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect(redirectForOperationalProfile(user.perfil));
  return user;
}

export async function requireOperacaoUser(): Promise<AppUser> {
  const user = await requireAppUser();
  if (!canAccessOperacao(user.perfil)) redirect(redirectForOperationalProfile(user.perfil));
  return user;
}

export async function requireUserManager(): Promise<AppUser> {
  const user = await requireAppUser();
  if (!canManageUsers(user.perfil)) redirect("/");
  return user;
}

export { PERFIS_USUARIO };
