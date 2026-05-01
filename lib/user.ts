const COMMON_FIRST_NAMES = [
  "adriano",
  "alexandre",
  "amanda",
  "ana",
  "andre",
  "antonio",
  "beatriz",
  "brenda",
  "bruno",
  "carlos",
  "daniel",
  "diego",
  "eduardo",
  "fabio",
  "fabiola",
  "felipe",
  "fernanda",
  "fernando",
  "francisco",
  "gabriel",
  "gustavo",
  "isabela",
  "jaceira",
  "joao",
  "jose",
  "juliana",
  "lucas",
  "luciana",
  "luiz",
  "marcos",
  "maria",
  "mariana",
  "mayky",
  "mazurkey",
  "ordens",
  "paula",
  "pedro",
  "rafael",
  "renata",
  "ricardo",
  "rodrigo",
  "rosana",
  "suelem",
  "thiago",
  "victor",
  "walter",
  "wanderlucio",
].sort((a, b) => b.length - a.length);

function capitalizePart(part: string): string {
  if (!part) return part;
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalizePart)
    .join(" ");
}

function splitCompactLocalPart(localPart: string): string[] {
  const match = COMMON_FIRST_NAMES.find(
    (firstName) => localPart.startsWith(firstName) && localPart.length > firstName.length
  );

  if (!match) return [localPart];
  return [match, localPart.slice(match.length)];
}

export function formatUserNameFromEmail(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) return email.trim();

  const localPart = normalizedEmail.split("@")[0];
  const separated = localPart
    .replace(/[._+-]+/g, " ")
    .replace(/\d+/g, " ")
    .trim();

  if (!separated) return normalizedEmail;

  const parts = separated.includes(" ") ? separated.split(/\s+/) : splitCompactLocalPart(separated);
  return titleCase(parts.join(" "));
}

export function normalizeUserDisplayName(name?: string | null, email?: string | null): string {
  const cleanName = name?.trim();
  if (cleanName && !cleanName.includes("@")) return titleCase(cleanName);
  if (email) return formatUserNameFromEmail(email);
  return cleanName || "";
}
