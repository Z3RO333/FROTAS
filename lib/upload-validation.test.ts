import { describe, expect, it } from "vitest";
import { UploadValidationError, validateImageFile, validatePdfFile } from "./upload-validation";

describe("upload validation", () => {
  it("aceita PNG com assinatura válida", async () => {
    const file = new File([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ], "painel.png", { type: "image/png" });
    await expect(validateImageFile(file, "Foto")).resolves.toBeUndefined();
  });

  it("rejeita MIME de imagem com conteúdo falso", async () => {
    const file = new File(["não é imagem"], "painel.png", { type: "image/png" });
    await expect(validateImageFile(file, "Foto")).rejects.toBeInstanceOf(UploadValidationError);
  });

  it("rejeita extensão PDF com conteúdo falso", async () => {
    const file = new File(["conteúdo"], "documento.pdf", { type: "application/pdf" });
    await expect(validatePdfFile(file, "Documento")).rejects.toThrow("PDF válido");
  });

  it("aceita PDF com magic bytes", async () => {
    const file = new File(["%PDF-1.7\n"], "documento.pdf", { type: "application/pdf" });
    await expect(validatePdfFile(file, "Documento")).resolves.toBeUndefined();
  });
});

