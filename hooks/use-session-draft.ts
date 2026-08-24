"use client";

import { useCallback, useEffect, useState } from "react";
import type { ZodType } from "zod";

/**
 * Rascunho versionado em sessionStorage (não localStorage — some ao fechar a aba,
 * não sobrevive além da sessão). Schema inválido/expirado é descartado em silêncio;
 * quem chama decide se avisa o usuário. Nunca lança — sessionStorage indisponível
 * (modo privado, quota cheia) não pode derrubar o formulário.
 */
export function useSessionDraft<T>(key: string, schema: ZodType<T>) {
  const [restoredDraft, setRestoredDraft] = useState<T | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setChecked(false);
    setRestoredDraft(null);
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        const parsed = schema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          setRestoredDraft(parsed.data);
        } else {
          window.sessionStorage.removeItem(key);
        }
      }
    } catch {
      // sessionStorage indisponível — segue sem rascunho, não é erro fatal.
    } finally {
      setChecked(true);
    }
  }, [key, schema]);

  const save = useCallback(
    (value: T) => {
      try {
        window.sessionStorage.setItem(key, JSON.stringify(value));
      } catch {
        // rascunho é conveniência, não pode quebrar o envio do formulário.
      }
    },
    [key]
  );

  const clear = useCallback(() => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // idem.
    }
  }, [key]);

  return { restoredDraft, checked, save, clear };
}
