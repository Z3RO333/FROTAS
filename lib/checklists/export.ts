import * as XLSX from "xlsx";
import { CHECKLIST_ITEMS, type ChecklistStatusGeral, type ChecklistStatusItem } from "@/lib/checklists/catalog";
import { REPORT_TIME_ZONE } from "@/lib/report-date";
import type { ChecklistItemRow, ChecklistListRow } from "@/lib/repos/checklists";

// Mesma redação usada em app/(app)/portaria/veiculo-sheet.tsx, para o status
// geral aparecer com o mesmo nome em toda a aplicação.
const STATUS_GERAL_LABEL: Record<ChecklistStatusGeral, string> = {
  APROVADO: "Aprovado",
  COM_OBSERVACAO: "Com observação",
  NAO_APTO: "Não conformidades",
  CRITICO: "Não conformidade crítica",
};

const STATUS_ITEM_LABEL: Record<ChecklistStatusItem, string> = {
  APTO: "OK",
  NAO_APTO: "Problema",
  NAO_SE_APLICA: "Não se aplica",
};

function dataHoraLocal(criadoEm: string | null): { data: string; hora: string } {
  if (!criadoEm) return { data: "", hora: "" };
  const dt = new Date(criadoEm);
  if (Number.isNaN(dt.getTime())) return { data: "", hora: "" };
  return {
    data: dt.toLocaleDateString("pt-BR", { timeZone: REPORT_TIME_ZONE }),
    hora: dt.toLocaleTimeString("pt-BR", { timeZone: REPORT_TIME_ZONE, hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * Monta a planilha de exportação de checklists: uma aba "Checklists" em
 * formato largo (uma linha por checklist, um item do catálogo por coluna) e
 * uma aba "Itens detalhados" em formato longo (uma linha por item por
 * checklist), que preserva a observação individual de cada item — a aba
 * larga guarda só o status, senão a observação de um item ficaria escondida
 * atrás da de outro na mesma célula.
 */
export function buildChecklistsExportWorkbook(
  checklists: ChecklistListRow[],
  itemsByChecklist: Map<number, ChecklistItemRow[]>
): Buffer {
  const headerChecklists = [
    "Checklist",
    "Frota",
    "Placa",
    "Modelo",
    "CD",
    "Setor",
    "Motorista",
    "Data",
    "Horário",
    "KM informado",
    "Status geral",
    "Observação",
    ...CHECKLIST_ITEMS.map((item) => item.nome),
  ];

  const rowsChecklists = checklists.map((c) => {
    const { data, hora } = dataHoraLocal(c.criado_em);
    const itens = itemsByChecklist.get(c.id) ?? [];
    const porCodigo = new Map(itens.map((item) => [item.item_codigo, item]));
    const observacao = c.observacao_corrigida_ia?.trim() || c.observacao_original?.trim() || "";

    return [
      c.id,
      c.frota_geral ?? "",
      c.placa ?? "",
      c.modelo ?? "",
      c.localizacao ?? "",
      c.rota ?? "",
      c.motorista_nome ?? c.motorista_id,
      data,
      hora,
      c.km_informado ?? "",
      STATUS_GERAL_LABEL[c.status_geral] ?? c.status_geral,
      observacao,
      ...CHECKLIST_ITEMS.map((item) => {
        const registrado = porCodigo.get(item.codigo);
        return registrado ? STATUS_ITEM_LABEL[registrado.status] ?? registrado.status : "";
      }),
    ];
  });

  const wsChecklists = XLSX.utils.aoa_to_sheet([headerChecklists, ...rowsChecklists]);
  wsChecklists["!cols"] = headerChecklists.map((_, index) => ({
    wch: index === 11 ? 50 : index >= headerChecklists.length - CHECKLIST_ITEMS.length ? 16 : 14,
  }));
  wsChecklists["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowsChecklists.length, c: headerChecklists.length - 1 } }) };

  const headerItens = [
    "Checklist",
    "Frota",
    "Placa",
    "Data",
    "Grupo",
    "Item",
    "Status",
    "Obrigatório",
    "Crítico",
    "Observação do item",
  ];
  const rowsItens: (string | number)[][] = [];
  for (const c of checklists) {
    const { data } = dataHoraLocal(c.criado_em);
    for (const item of itemsByChecklist.get(c.id) ?? []) {
      rowsItens.push([
        c.id,
        c.frota_geral ?? "",
        c.placa ?? "",
        data,
        item.grupo,
        item.item_nome,
        STATUS_ITEM_LABEL[item.status] ?? item.status,
        item.obrigatorio ? "Sim" : "Não",
        item.critico ? "Sim" : "Não",
        item.observacao ?? "",
      ]);
    }
  }
  const wsItens = XLSX.utils.aoa_to_sheet([headerItens, ...rowsItens]);
  wsItens["!cols"] = headerItens.map((_, index) => ({ wch: index === headerItens.length - 1 ? 50 : 14 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsChecklists, "Checklists");
  XLSX.utils.book_append_sheet(wb, wsItens, "Itens detalhados");

  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

/** Nome de arquivo determinístico a partir do intervalo pedido, sem caracteres inválidos no Windows. */
export function checklistsExportFilename(dataInicio?: string, dataFim?: string): string {
  if (dataInicio && dataFim && dataInicio !== dataFim) return `checklists_${dataInicio}_a_${dataFim}.xlsx`;
  if (dataInicio || dataFim) return `checklists_${dataInicio ?? dataFim}.xlsx`;
  return `checklists_${new Date().toISOString().slice(0, 10)}.xlsx`;
}
