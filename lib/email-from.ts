export type EmailFrom = {
  email: string;
  name: string;
};

const DEFAULT_FROM_EMAIL = "ordensmanutencao@bemol.com.br";
const DEFAULT_FROM_NAME = "Manutenção CD";

function parseEmailWithName(value: string | undefined): EmailFrom | null {
  const raw = value?.trim();
  if (!raw) return null;

  const match = raw.match(/^(.*?)\s*<([^<>@\s]+@[^<>@\s]+)>$/);
  if (!match) return { email: raw, name: process.env.FROM_NAME?.trim() || DEFAULT_FROM_NAME };

  const name = match[1]?.trim().replace(/^"|"$/g, "") || DEFAULT_FROM_NAME;
  const email = match[2]?.trim();
  return email ? { email, name } : null;
}

export function getEmailFrom(): EmailFrom {
  const configured =
    parseEmailWithName(process.env.SENDGRID_FROM_EMAIL) ??
    parseEmailWithName(process.env.FROM_EMAIL);

  return {
    email: configured?.email ?? DEFAULT_FROM_EMAIL,
    name: process.env.SENDGRID_FROM_NAME?.trim() || configured?.name || DEFAULT_FROM_NAME,
  };
}
