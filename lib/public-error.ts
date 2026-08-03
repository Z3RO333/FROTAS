import { UploadValidationError } from "@/lib/upload-validation";

const TECHNICAL_ERROR = /(?:^\w+:|pgrst|postgrest|supabase|sqlstate|duplicate key|violates .* constraint|relation .* does not exist|column .* does not exist|bucket|storage|econn|enotfound|fetch failed|jwt|service[_ -]?role)/i;

/** Mantém erros de validação úteis e oculta detalhes de infraestrutura. */
export function publicActionError(error: unknown, fallback: string): string {
  if (error instanceof UploadValidationError) return error.message;
  if (error instanceof Error && error.message && !TECHNICAL_ERROR.test(error.message)) {
    return error.message;
  }
  console.error("[action] falha interna", error);
  return fallback;
}

