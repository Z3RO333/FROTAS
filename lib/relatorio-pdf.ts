import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { normalizeCdNome } from "@/lib/cd-utils";
import { formatReportDate } from "@/lib/report-date";

export type RelatorioResumoPdfInput = {
  dataRef: Date;
  totalChecklists: number;
  totalApontamentos: number;
  frotasFizeram: { frota_id: number; localizacao: string | null }[];
  frotasNaoFizeram: { frota_id: number; localizacao: string | null }[];
};

const INK = rgb(0.09, 0.11, 0.15);
const MUTED = rgb(0.4, 0.45, 0.52);
const BLUE = rgb(0.043, 0.247, 0.557);

function porCd(frotas: { localizacao: string | null }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const f of frotas) {
    const cd = normalizeCdNome(f.localizacao);
    map.set(cd, (map.get(cd) ?? 0) + 1);
  }
  return map;
}

export async function buildRelatorioOperacionalResumoPdf(input: RelatorioResumoPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const marginX = 48;
  let y = 780;

  page.drawText("Relatório Checklist Diário — Resumo Geral", {
    x: marginX,
    y,
    size: 18,
    font: fontBold,
    color: BLUE,
  });
  y -= 22;
  page.drawText(formatReportDate(input.dataRef), { x: marginX, y, size: 11, font: fontRegular, color: MUTED });
  y -= 36;

  const totalFrotas = input.frotasFizeram.length + input.frotasNaoFizeram.length;
  const pctFizeram = totalFrotas > 0 ? Math.round((input.frotasFizeram.length / totalFrotas) * 100) : 0;

  const kpis: [string, string][] = [
    ["Total de frotas", String(totalFrotas)],
    ["Fizeram checklist", `${input.frotasFizeram.length} (${pctFizeram}%)`],
    ["Checklists realizados", String(input.totalChecklists)],
    ["Apontamentos", String(input.totalApontamentos)],
  ];

  const kpiBoxWidth = (595.28 - marginX * 2 - 3 * 12) / 4;
  kpis.forEach(([label, value], index) => {
    const x = marginX + index * (kpiBoxWidth + 12);
    page.drawRectangle({
      x,
      y: y - 58,
      width: kpiBoxWidth,
      height: 58,
      borderColor: rgb(0.82, 0.87, 0.93),
      borderWidth: 1,
    });
    page.drawText(label.toUpperCase(), { x: x + 10, y: y - 20, size: 8, font: fontRegular, color: MUTED });
    page.drawText(value, { x: x + 10, y: y - 42, size: 16, font: fontBold, color: INK });
  });
  y -= 90;

  page.drawText("Frotas em dia por CD", { x: marginX, y, size: 13, font: fontBold, color: INK });
  y -= 22;

  const fizeramPorCd = porCd(input.frotasFizeram);
  const naoFizeramPorCd = porCd(input.frotasNaoFizeram);
  const cds = new Set([...fizeramPorCd.keys(), ...naoFizeramPorCd.keys()]);

  const colX = { cd: marginX, fizeram: marginX + 260, total: marginX + 340, pct: marginX + 420 };
  page.drawText("CD", { x: colX.cd, y, size: 9, font: fontBold, color: MUTED });
  page.drawText("Fizeram", { x: colX.fizeram, y, size: 9, font: fontBold, color: MUTED });
  page.drawText("Total", { x: colX.total, y, size: 9, font: fontBold, color: MUTED });
  page.drawText("%", { x: colX.pct, y, size: 9, font: fontBold, color: MUTED });
  y -= 6;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: 595.28 - marginX, y },
    thickness: 1,
    color: rgb(0.82, 0.87, 0.93),
  });
  y -= 16;

  for (const cd of [...cds].sort((a, b) => a.localeCompare(b, "pt-BR"))) {
    const fez = fizeramPorCd.get(cd) ?? 0;
    const naoFez = naoFizeramPorCd.get(cd) ?? 0;
    const total = fez + naoFez;
    const pct = total > 0 ? Math.round((fez / total) * 100) : 0;

    page.drawText(cd, { x: colX.cd, y, size: 10, font: fontRegular, color: INK });
    page.drawText(String(fez), { x: colX.fizeram, y, size: 10, font: fontRegular, color: INK });
    page.drawText(String(total), { x: colX.total, y, size: 10, font: fontRegular, color: INK });
    page.drawText(`${pct}%`, { x: colX.pct, y, size: 10, font: fontRegular, color: INK });
    y -= 18;

    if (y < 60) break;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
