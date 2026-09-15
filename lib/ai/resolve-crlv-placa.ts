import { CONFIDENCE_THRESHOLD, type CrlvReading } from "./crlv-ocr";

export type VerificacaoPlacaCrlv = {
  divergente: boolean;
  placaLida: string | null;
};

function normalizarPlaca(valor: string): string {
  return valor.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Só sinaliza divergência quando a IA leu a placa com confiança suficiente —
// falha de leitura ou confiança baixa nunca gera aviso (mesmo padrão de
// resolve-crlv-vencimento.ts: a IA nunca é motivo de bloqueio, só de aviso).
export function verificarPlacaCrlv(reading: CrlvReading, placaFormulario: string): VerificacaoPlacaCrlv {
  if (!reading.placa || reading.confianca < CONFIDENCE_THRESHOLD) {
    return { divergente: false, placaLida: reading.placa };
  }
  const divergente = normalizarPlaca(reading.placa) !== normalizarPlaca(placaFormulario);
  return { divergente, placaLida: reading.placa };
}
