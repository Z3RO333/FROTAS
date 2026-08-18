import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { renderFirstPageToPng } from "./pdf-render";

async function buildTestPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([400, 300]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("CRLV DE TESTE - Valido ate 15/05/2026", { x: 20, y: 150, size: 14, font });
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

describe("renderFirstPageToPng", () => {
  it("renderiza a primeira página de um PDF válido como PNG não vazio", async () => {
    const pdfBuffer = await buildTestPdf();
    const png = await renderFirstPageToPng(pdfBuffer);
    expect(png).toBeInstanceOf(Buffer);
    expect(png.length).toBeGreaterThan(0);
    // Assinatura PNG: 89 50 4E 47 0D 0A 1A 0A
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("propaga erro para PDF corrompido/inválido", async () => {
    const garbage = Buffer.from("isso não é um PDF");
    await expect(renderFirstPageToPng(garbage)).rejects.toThrow();
  });
});
