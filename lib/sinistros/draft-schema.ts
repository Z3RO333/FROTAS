import { z } from "zod";

// v1: campos leves e não-sensíveis do formulário de sinistro/socorro.
// Terceiros (CPF/telefone) e arquivos NUNCA entram no draft — decisão de
// privacidade deliberada, ver plano de evolução de UX/navegação.
export const SINISTRO_DRAFT_VERSION = 1 as const;
export const SINISTRO_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export const sinistroDraftSchema = z.object({
  version: z.literal(SINISTRO_DRAFT_VERSION),
  savedAt: z.number(),
  submissionId: z.string().uuid(),

  tipo: z.enum(["veiculo", "casa", "socorro"]),
  frotaId: z.number().nullable(),
  endereco: z.string(),
  latitude: z.string(),
  longitude: z.string(),
  setor: z.string(),
  descricao: z.string(),

  houveFeridos: z.enum(["sim", "nao"]).optional(),
  samuBombeiros: z.enum(["sim", "nao"]).optional(),
  precisaGuincho: z.enum(["sim", "nao"]).optional(),
});

export type SinistroDraft = z.infer<typeof sinistroDraftSchema>;
export type SinistroDraftInput = Omit<SinistroDraft, "version" | "savedAt">;

// Hash não-criptográfico (djb2) — só pra não deixar o e-mail em texto puro
// na chave do sessionStorage. Não precisa resistir a ataque, só a leitura casual.
export function hashEmail(email: string): string {
  let hash = 5381;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) + hash + email.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function sinistroDraftKey(email: string, tipo: SinistroDraft["tipo"]): string {
  return `frotas:sinistro-draft:v1:${hashEmail(email)}:${tipo}`;
}

export function buildSinistroDraft(input: SinistroDraftInput): SinistroDraft {
  return { ...input, version: SINISTRO_DRAFT_VERSION, savedAt: Date.now() };
}

export function isSinistroDraftExpired(draft: SinistroDraft, now: number = Date.now()): boolean {
  return now - draft.savedAt > SINISTRO_DRAFT_TTL_MS;
}
