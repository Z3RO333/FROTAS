import { createCanvas } from "@napi-rs/canvas";
// Build "legacy" roda sem worker em Node — evita configurar GlobalWorkerOptions.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Renderiza a primeira página de um PDF como PNG, em memória. Usado pra dar à IA
// de visão uma imagem que ela consegue ler (o modelo de chat.completions não
// aceita PDF direto) — o PDF original nunca é alterado, isso é só um passo
// temporário antes da chamada à IA.
export async function renderFirstPageToPng(pdfBuffer: Buffer): Promise<Buffer> {
  const loadingTask = getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(1);
    // Escala 2x: texto pequeno do CRLV (datas, campos) fica legível pro modelo.
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");

    await page.render({
      canvas: null,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    return canvas.toBuffer("image/png");
  } finally {
    await loadingTask.destroy();
  }
}
