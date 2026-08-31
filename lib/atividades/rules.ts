/** Máximo de fotos anexadas na conclusão de uma atividade. */
export const MAX_FOTOS_ATIVIDADE = 5;

export const ATIVIDADE_TIPOS = ["LEVAR_PARA", "LIBERADA", "TESTE_PERCURSO", "OUTRO"] as const;
export type AtividadeTipo = (typeof ATIVIDADE_TIPOS)[number];

export const TIPO_ATIVIDADE_LABELS: Record<AtividadeTipo, string> = {
  LEVAR_PARA: "Levar para",
  LIBERADA: "Liberada em",
  TESTE_PERCURSO: "Teste de percurso",
  OUTRO: "Outro",
};

export function requiresFotoNaConclusao(tipo: AtividadeTipo): boolean {
  return tipo === "LEVAR_PARA";
}

export function requiresChecklistDoDia(tipo: AtividadeTipo): boolean {
  return tipo === "LEVAR_PARA";
}

export function formatDuracao(inicioIso: string, fimIso: string): string {
  const inicio = new Date(inicioIso).getTime();
  const fim = new Date(fimIso).getTime();
  const minutosTotais = Math.max(0, Math.floor((fim - inicio) / 60_000));
  const horas = Math.floor(minutosTotais / 60);
  const minutos = minutosTotais % 60;
  if (horas === 0) return `${minutos}min`;
  return `${horas}h${String(minutos).padStart(2, "0")}min`;
}
