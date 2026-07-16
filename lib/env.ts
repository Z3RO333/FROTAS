import "server-only";

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return value;
}

export function requiredUrlEnv(name: string): string {
  const value = requiredEnv(name);
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) {
      throw new Error("protocolo inválido");
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Variável ${name} deve conter uma URL HTTP(S) válida.`);
  }
}

