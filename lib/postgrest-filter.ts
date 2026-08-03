/**
 * Valores interpolados em `.or()` usam a gramática textual do PostgREST.
 * Esta allowlist remove operadores e delimitadores antes da interpolação.
 */
export function safePostgrestTerm(value: string, maxLength = 100): string {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

