import type {
  ChecklistCatalogItem,
  ChecklistStatusGeral,
  ChecklistStatusItem,
  GravidadePendencia,
} from "@/lib/checklists/catalog";

export type ChecklistItemInput = {
  catalogItem: ChecklistCatalogItem;
  status: ChecklistStatusItem;
  observacao?: string | null;
  hasFoto?: boolean;
};

export type KmValidation = {
  ok: boolean;
  reason?: "MENOR_QUE_ULTIMO" | "VARIACAO_INCOMUM";
  diff: number | null;
};

export const KM_VARIACAO_INCOMUM = 1500;

export function validateKm(
  kmInformado: number,
  ultimoKm: number | null | undefined,
  justificativa?: string | null
): KmValidation {
  if (ultimoKm == null) return { ok: true, diff: null };

  const diff = kmInformado - ultimoKm;
  if (diff < 0 && !justificativa?.trim()) {
    return { ok: false, reason: "MENOR_QUE_ULTIMO", diff };
  }
  return { ok: true, diff };
}

export function itemNeedsEvidence(item: ChecklistItemInput): boolean {
  return item.status === "NAO_APTO" && !item.observacao?.trim() && !item.hasFoto;
}

export function statusGeralFromItems(
  items: ChecklistItemInput[],
  observacaoOriginal?: string | null
): ChecklistStatusGeral {
  if (items.some((item) => item.status === "NAO_APTO" && item.catalogItem.critico)) return "CRITICO";
  if (items.some((item) => item.status === "NAO_APTO")) return "NAO_APTO";
  if (items.some((item) => item.observacao?.trim()) || observacaoOriginal?.trim()) return "COM_OBSERVACAO";
  return "APROVADO";
}

export function gravidadePendencia(item: ChecklistCatalogItem): GravidadePendencia {
  return item.critico ? "CRITICA" : "MEDIA";
}

export function normalizeDriverNote(text: string | null | undefined): string | null {
  const clean = text?.trim();
  if (!clean) return null;
  return clean.charAt(0).toUpperCase() + clean.slice(1).replace(/\s+/g, " ");
}
