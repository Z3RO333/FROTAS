import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildChecklistsExportWorkbook, checklistsExportFilename } from "./export";
import { CHECKLIST_ITEMS } from "./catalog";
import type { ChecklistItemRow, ChecklistListRow } from "@/lib/repos/checklists";

function checklist(overrides: Partial<ChecklistListRow> = {}): ChecklistListRow {
  return {
    id: 1,
    frota_id: 10,
    frota_geral: "108",
    placa: "PHQ-2397",
    modelo: "ACCELO 815/ M. BENZ",
    localizacao: "CD Tarumã",
    rota: "EXPEDIÇÃO MANAUS",
    motorista_id: "juliana@bemol.com.br",
    motorista_nome: "Juliana Alves",
    data_checklist: "2026-09-09T13:20:00.000Z",
    km_informado: 189214,
    km_lido_ocr: null,
    ocr_confianca: null,
    km_confirmado: null,
    foto_km_url: null,
    status_geral: "APROVADO",
    observacao_original: null,
    observacao_corrigida_ia: null,
    criado_em: "2026-09-09T13:20:21.252923+00:00",
    ...overrides,
  };
}

function item(overrides: Partial<ChecklistItemRow> = {}): ChecklistItemRow {
  return {
    id: 1,
    checklist_id: 1,
    item_codigo: "kit_seguranca",
    item_nome: "Kit segurança (triângulo, macaco, chave de roda e extintor)",
    grupo: "Seguranca",
    status: "APTO",
    obrigatorio: true,
    critico: true,
    observacao: null,
    foto_url: null,
    ...overrides,
  };
}

function readSheet(buf: Buffer, sheetName: string): unknown[][] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
}

describe("buildChecklistsExportWorkbook", () => {
  it("gera um .xlsx válido e não vazio", () => {
    const buf = buildChecklistsExportWorkbook([checklist()], new Map());
    expect(buf.length).toBeGreaterThan(0);
    // assinatura ZIP (xlsx é um zip) — PK\x03\x04
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("tem duas abas: Checklists e Itens detalhados", () => {
    const buf = buildChecklistsExportWorkbook([checklist()], new Map());
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toEqual(["Checklists", "Itens detalhados"]);
  });

  it("a aba Checklists tem uma coluna por item do catálogo, com o status certo", () => {
    const c = checklist({ id: 42 });
    const itens = new Map([
      [42, [
        item({ checklist_id: 42, item_codigo: "kit_seguranca", status: "APTO" }),
        item({ checklist_id: 42, item_codigo: "freios", item_nome: "Freios / Óleo", status: "NAO_APTO", observacao: "vazando óleo" }),
      ]],
    ]);

    const buf = buildChecklistsExportWorkbook([c], itens);
    const rows = readSheet(buf, "Checklists");
    const header = rows[0] as string[];
    const data = rows[1] as unknown[];

    const idxKit = header.indexOf(CHECKLIST_ITEMS.find((i) => i.codigo === "kit_seguranca")!.nome);
    const idxFreios = header.indexOf(CHECKLIST_ITEMS.find((i) => i.codigo === "freios")!.nome);
    const idxTacografo = header.indexOf(CHECKLIST_ITEMS.find((i) => i.codigo === "tacografo")!.nome);

    expect(data[idxKit]).toBe("OK");
    expect(data[idxFreios]).toBe("Problema");
    // item não respondido nesse checklist: célula vazia
    expect(data[idxTacografo]).toBe("");
  });

  it("usa KM informado, status geral e observação corrigida pela IA quando existe", () => {
    const c = checklist({
      km_informado: 189214,
      status_geral: "CRITICO",
      observacao_original: "texto bruto do motorista",
      observacao_corrigida_ia: "texto revisado",
    });
    const buf = buildChecklistsExportWorkbook([c], new Map());
    const rows = readSheet(buf, "Checklists");
    const header = rows[0] as string[];
    const data = rows[1] as unknown[];

    expect(data[header.indexOf("KM informado")]).toBe(189214);
    expect(data[header.indexOf("Status geral")]).toBe("Não conformidade crítica");
    expect(data[header.indexOf("Observação")]).toBe("texto revisado");
  });

  it("a aba Itens detalhados tem uma linha por item, preservando a observação individual", () => {
    const c = checklist({ id: 7 });
    const itens = new Map([
      [7, [
        item({ checklist_id: 7, item_codigo: "kit_seguranca", status: "APTO" }),
        item({ checklist_id: 7, item_codigo: "freios", item_nome: "Freios / Óleo", status: "NAO_APTO", observacao: "freio de mão não funciona" }),
      ]],
    ]);

    const buf = buildChecklistsExportWorkbook([c], itens);
    const rows = readSheet(buf, "Itens detalhados");

    expect(rows.length).toBe(3); // header + 2 itens
    const header = rows[0] as string[];
    const linhaFreios = rows.find((r) => (r as string[])[header.indexOf("Item")] === "Freios / Óleo")!;
    expect(linhaFreios[header.indexOf("Status")]).toBe("Problema");
    expect(linhaFreios[header.indexOf("Observação do item")]).toBe("freio de mão não funciona");
  });

  it("não quebra quando não há itens para um checklist", () => {
    const buf = buildChecklistsExportWorkbook([checklist({ id: 99 })], new Map());
    const rows = readSheet(buf, "Itens detalhados");
    expect(rows.length).toBe(1); // só o header
  });

  it("gera planilha vazia (só cabeçalho) para lista vazia, sem lançar erro", () => {
    const buf = buildChecklistsExportWorkbook([], new Map());
    const rows = readSheet(buf, "Checklists");
    expect(rows.length).toBe(1);
  });
});

describe("checklistsExportFilename", () => {
  it("um único dia gera nome com a data", () => {
    expect(checklistsExportFilename("2026-09-09", "2026-09-09")).toBe("checklists_2026-09-09.xlsx");
  });

  it("intervalo de datas gera nome com as duas pontas", () => {
    expect(checklistsExportFilename("2026-09-03", "2026-09-05")).toBe("checklists_2026-09-03_a_2026-09-05.xlsx");
  });

  it("sem nenhuma data usa a data de hoje", () => {
    expect(checklistsExportFilename(undefined, undefined)).toMatch(/^checklists_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
