import type { CrlvReading } from "./crlv-ocr";

export type CrlvVencimentoResolvido = {
  crlv_vencimento: string | null;
  crlv_vencimento_origem: "MANUAL" | "IA" | null;
  crlv_vencimento_confianca: number | null;
  crlv_revisar_manualmente: boolean;
};

// Decide qual data de vencimento gravar: a lida pela IA (quando confiável,
// prevalece sobre o que foi digitado — é a fonte real do documento) ou a
// digitada manualmente (quando a IA não conseguiu ler com segurança).
export function resolveCrlvVencimento(reading: CrlvReading, manualDate: string | null): CrlvVencimentoResolvido {
  if (reading.leitura_segura && reading.data_vencimento) {
    return {
      crlv_vencimento: reading.data_vencimento,
      crlv_vencimento_origem: "IA",
      crlv_vencimento_confianca: reading.confianca,
      crlv_revisar_manualmente: false,
    };
  }

  return {
    crlv_vencimento: manualDate,
    crlv_vencimento_origem: manualDate ? "MANUAL" : null,
    crlv_vencimento_confianca: reading.confianca,
    crlv_revisar_manualmente: true,
  };
}
